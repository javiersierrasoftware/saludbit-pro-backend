import { Request, Response } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { QuestionType } from '@prisma/client';

export const getAssignedSurveys = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  // --- LOG DE RASTREO #3: VERIFICAR EL USUARIO QUE CONSULTA LAS ENCUESTAS ---
  console.log(`\n🔍 [getAssignedSurveys] Petición para obtener encuestas del usuario con ID: ${userId}`);

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    let surveysToShow;

    if (user.role === 'ADMIN' || user.role === 'INSTITUTION_ADMIN') {
      // Para administradores, mostramos los registros de su institución (o todos si es super-admin)
      const whereClause: any = {};
      if (user.role === 'INSTITUTION_ADMIN') {
        whereClause.institutionId = user.institutionId;
      }

      const surveys = await prisma.survey.findMany({
        where: whereClause,
        include: { _count: { select: { questions: true } } },
        orderBy: { createdAt: 'desc' },
      });

      // Envolvemos los registros en un formato similar al de una asignación para consistencia en el frontend
      surveysToShow = surveys.map(survey => ({
        survey,
        status: 'PENDING', // El estado no es relevante para el admin en esta vista
        dueDate: survey.endDate,
      }));
    } else {
      // Para estudiantes, mostramos solo los registros asignados
      const assignments = await prisma.surveyAssignment.findMany({
        where: {
          userId,
          createdAt: { not: undefined },
        },
        include: {
          survey: {
            include: {
              _count: { select: { questions: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      surveysToShow = assignments
        .filter(assignment => assignment.survey)
        .map(assignment => ({
          survey: assignment.survey,
          status: assignment.status,
          dueDate: assignment.dueDate,
        }));
    }

    res.status(200).json(surveysToShow);
  } catch (error) {
    console.error('Error al obtener encuestas asignadas:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const getSurveyById = async (req: AuthRequest, res: Response) => {
  const { surveyId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  console.log(`[getSurveyById] Petición para obtener registro con ID: ${surveyId}`);

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    let surveyResponse;

    if (user.role === 'ADMIN' || user.role === 'INSTITUTION_ADMIN') {
      // Para administradores, buscamos el registro directamente.
      const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
      if (!survey) {
        return res.status(404).json({ message: 'Registro no encontrado.' });
      }
      // Creamos un objeto similar a una asignación para mantener la consistencia en el frontend.
      surveyResponse = {
        survey,
        status: 'PENDING', // El estado no es relevante para el admin
        dueDate: survey.endDate,
      };
    } else {
      // Para estudiantes, buscamos la asignación.
      const assignment = await prisma.surveyAssignment.findUnique({
        where: { userId_surveyId: { userId, surveyId } },
        include: { survey: true },
      });

      if (!assignment) {
        console.warn(`[getSurveyById] No se encontró asignación para el usuario ${userId} y registro ${surveyId}`);
        return res.status(404).json({ message: 'Registro no encontrado o no asignado.' });
      }
      surveyResponse = assignment;
    }

    console.log(`[getSurveyById] Enviando datos del registro: ${JSON.stringify(surveyResponse, null, 2)}`);
    res.status(200).json(surveyResponse);
  } catch (error) {
    console.error(`[getSurveyById] ¡ERROR! al obtener el registro ${surveyId}:`, error);
    res.status(500).json({ message: 'Error al obtener el registro.' });
  }
};

export const createSurvey = async (req: AuthRequest, res: Response) => {
  const { title, description, startDate, endDate } = req.body;
  const adminId = req.userId; // Obtenemos el ID del admin desde el token

  // --- LOG DE RASTREO #4: VERIFICAR EL USUARIO QUE INTENTA CREAR LA ENCUESTA ---
  console.log(`\n📝 [createSurvey] Petición para crear encuesta del usuario con ID: ${adminId}`);

  if (!adminId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  if (!title || !description || !startDate || !endDate) {
    return res.status(400).json({ message: 'Todos los campos son requeridos.' });
  }

  try {
    // Verificamos el rol del usuario aquí, en lugar de en un middleware separado.
    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (!adminUser || (adminUser.role !== 'ADMIN' && adminUser.role !== 'INSTITUTION_ADMIN')) {
      return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
    }

    const newSurvey = await prisma.survey.create({
      data: {
        title,
        description,
        // Corregido: Aseguramos que startDate también se guarde.
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        institutionId: adminUser.institutionId, // Asignamos la institución del admin
      },
    });

    // ¡Paso clave! Asignar automáticamente la encuesta al admin que la creó.
    if (adminId) {
      await prisma.surveyAssignment.create({
        data: {
          surveyId: newSurvey.id,
          userId: adminId,
          status: 'PENDING', // O el estado inicial que prefieras
          createdAt: new Date(), // Aseguramos que el campo siempre se establezca
          dueDate: new Date(endDate), // Usamos la fecha de cierre del formulario
        },
      });
    }

    res.status(201).json(newSurvey);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la encuesta.' });
  }
};

export const getAllSurveys = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  const { groupId } = req.query; // Opcional: para verificar asignaciones existentes

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  try {
    let assignedSurveyIds = new Set<string>();

    if (typeof groupId === 'string') {
      // Si se proporciona un groupId, encontramos las encuestas ya asignadas a sus miembros.
      const members = await prisma.usersOnGroups.findMany({
        where: { groupId },
        select: { userId: true },
      });
      const memberIds = members.map(m => m.userId);

      if (memberIds.length > 0) {
        // Corregimos la consulta para que sea más precisa.
        const assignments = await prisma.surveyAssignment.findMany({
          where: {
            userId: { in: memberIds },
          },
          select: { surveyId: true }, // Obtenemos solo el ID de la encuesta asignada
        });
        assignedSurveyIds = new Set(assignments.map(a => a.surveyId));

        // --- LOG DE RASTREO: VERIFICAR LAS ENCUESTAS ASIGNADAS DETECTADAS ---
        console.log(`\n🔍 [getAllSurveys] Verificando asignaciones para el grupo ${groupId}.`);
        console.log(`   - Miembros del grupo: ${memberIds.length}`);
        console.log(`   - IDs de encuestas ya asignadas a este grupo:`, Array.from(assignedSurveyIds));
      }
    }

    // Obtenemos el usuario para filtrar por institución si es necesario
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const whereClause: any = {};
    if (user?.role === 'INSTITUTION_ADMIN') {
      whereClause.institutionId = user.institutionId;
    }

    const surveys = await prisma.survey.findMany({
      where: whereClause, // Aplicamos el filtro por institución
      orderBy: { createdAt: 'desc' },
    });

    // Añadimos un campo 'isAssigned' a cada encuesta para el frontend.
    const surveysWithStatus = surveys.map(survey => ({ ...survey, isAssigned: assignedSurveyIds.has(survey.id) }));

    res.status(200).json(surveysWithStatus);
  } catch (error) {
    console.error('Error al obtener todas las encuestas:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const addQuestionToSurvey = async (req: AuthRequest, res: Response) => {
  const { surveyId } = req.params;
  const { text, type, options } = req.body;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  if (!text || !type) {
    return res.status(400).json({ message: 'El texto y el tipo de la pregunta son requeridos.' });
  }

  // Validamos que el tipo de pregunta sea uno de los valores permitidos por el enum.
  // Limpiamos espacios en blanco y convertimos a mayúsculas para una validación robusta.
  const upperCaseType = type.trim().toUpperCase();
  if (!Object.values(QuestionType).includes(upperCaseType as QuestionType)) {
    return res.status(400).json({ message: `El tipo de pregunta '${type}' no es válido.` });
  }

  try {
    const newQuestion = await prisma.question.create({
      data: {
        text,
        // Aseguramos que el tipo sea del tipo enum correcto.
        type: upperCaseType as QuestionType,
        // El campo 'options' es obligatorio en el schema, así que siempre lo enviamos.
        // Si no hay opciones (ej. pregunta de texto), enviamos un array vacío.
        options: options || [],
        survey: {
          connect: { id: surveyId },
        },
      },
    });
    res.status(201).json(newQuestion);
  } catch (error) {
    console.error('Error al añadir pregunta:', error);
    res.status(500).json({ message: 'Error al añadir la pregunta a la encuesta.' });
  }
};

export const getQuestionById = async (req: AuthRequest, res: Response) => {
  const { questionId } = req.params;
  try {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });
    if (!question) {
      return res.status(404).json({ message: 'Pregunta no encontrada.' });
    }
    res.status(200).json(question);
  } catch (error) {
    console.error('Error al obtener la pregunta:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const updateQuestion = async (req: AuthRequest, res: Response) => {
  const { questionId } = req.params;
  const { text, type, options } = req.body;

  if (!text || !type) {
    return res.status(400).json({ message: 'El texto y el tipo de la pregunta son requeridos.' });
  }

  const upperCaseType = type.trim().toUpperCase();
  if (!Object.values(QuestionType).includes(upperCaseType as QuestionType)) {
    return res.status(400).json({ message: `El tipo de pregunta '${type}' no es válido.` });
  }

  try {
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: {
        text,
        type: upperCaseType as QuestionType,
        options: options || [],
      },
    });
    res.status(200).json(updatedQuestion);
  } catch (error) {
    console.error('Error al actualizar la pregunta:', error);
    res.status(500).json({ message: 'Error al actualizar la pregunta.' });
  }
};

export const getQuestionsForSurvey = async (req: AuthRequest, res: Response) => {
  const { surveyId } = req.params;
  const userId = req.userId;

  if (!surveyId) {
    return res.status(400).json({ message: 'El ID de la encuesta es requerido.' });
  }

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  console.log(`[getQuestionsForSurvey] Petición para obtener preguntas del registro con ID: ${surveyId}`);

  try {
    const questions = await prisma.question.findMany({
      where: {
        surveyId: surveyId,
      },
      // Opcional: Ordenar las preguntas por fecha de creación o algún otro criterio.
      orderBy: {
        createdAt: 'asc',
      },
    });

    // findMany devuelve un array vacío si no encuentra nada, por lo que no es necesario un chequeo de 'not found'.
    console.log(`[getQuestionsForSurvey] Se encontraron ${questions.length} preguntas.`);
    res.status(200).json(questions);
  } catch (error) {
    console.error(`[getQuestionsForSurvey] ¡ERROR! al obtener preguntas para el registro ${surveyId}:`, error);
    console.error('Error al obtener las preguntas de la encuesta:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const updateSurvey = async (req: AuthRequest, res: Response) => {
  const { surveyId } = req.params;
  const { endDate } = req.body;

  if (!endDate) {
    return res.status(400).json({ message: 'La fecha de cierre es requerida.' });
  }

  try {
    const newEndDate = new Date(endDate);

    // Usamos una transacción para asegurar que ambas actualizaciones ocurran o ninguna.
    const [updatedSurvey] = await prisma.$transaction([
      prisma.survey.update({
        where: { id: surveyId },
        data: { endDate: newEndDate },
      }),
      prisma.surveyAssignment.updateMany({
        where: { surveyId: surveyId },
        data: { dueDate: newEndDate },
      }),
    ]);

    res.status(200).json(updatedSurvey);
  } catch (error) {
    console.error('Error al actualizar la encuesta:', error);
    res.status(500).json({ message: 'Error al actualizar la encuesta.' });
  }
};

export const deleteSurvey = async (req: AuthRequest, res: Response) => {
  const { surveyId } = req.params;

  try {
    // Usamos una transacción para borrar todos los datos relacionados de forma segura.
    await prisma.$transaction([
      // 1. Borrar respuestas (si existieran en el futuro)
      // 2. Borrar preguntas
      prisma.question.deleteMany({
        where: { surveyId: surveyId },
      }),
      // 3. Borrar asignaciones de la encuesta
      prisma.surveyAssignment.deleteMany({
        where: { surveyId: surveyId },
      }),
      // 4. Finalmente, borrar la encuesta
      prisma.survey.delete({
        where: { id: surveyId },
      }),
    ]);

    res.status(204).send(); // 204 No Content: Éxito, sin contenido que devolver.
  } catch (error) {
    console.error('Error al eliminar la encuesta:', error);
    res.status(500).json({ message: 'Error al eliminar la encuesta.' });
  }
};

export const getSurveyResults = async (req: AuthRequest, res: Response) => {
  const { surveyId } = req.params;

  try {
    // 1. Obtener todas las preguntas de la encuesta.
    const questions = await prisma.question.findMany({
      where: { surveyId },
      orderBy: { createdAt: 'asc' },
    });

    if (questions.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Obtener todas las respuestas para esas preguntas.
    const answers = await prisma.userAnswer.findMany({
      where: {
        questionId: { in: questions.map((q) => q.id) },
      },
    });

    // 3. Procesar y agregar los resultados.
    const results = questions.map((question) => {
      const questionAnswers = answers.filter((a) => a.questionId === question.id);
      let summary: any;

      if (question.type === 'TEXT') {
        summary = questionAnswers.map((a) => a.value).filter(Boolean); // Lista de respuestas de texto.
      } else {
        // Contar votos para preguntas de selección.
        summary = {};
        question.options.forEach((option) => {
          summary[option] = 0; // Inicializar todas las opciones en 0.
        });
        questionAnswers.forEach((answer) => {
          answer.options.forEach((option) => {
            if (summary[option] !== undefined) {
              summary[option]++;
            }
          });
        });
      }

      return { ...question, results: summary };
    });

    res.status(200).json(results);
  } catch (error) {
    console.error('Error al obtener los resultados de la encuesta:', error);
    res.status(500).json({ message: 'Error al obtener los resultados.' });
  }
};

export const exportSurveyResults = async (req: AuthRequest, res: Response) => {
  const { surveyId } = req.params;

  try {
    // 1. Obtener la encuesta y sus preguntas
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!survey) {
      return res.status(404).json({ message: 'Encuesta no encontrada.' });
    }

    // 2. Obtener todas las respuestas para las preguntas de esta encuesta
    const answers = await prisma.userAnswer.findMany({
      where: {
        questionId: { in: survey.questions.map((q) => q.id) },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // 3. Agrupar respuestas por usuario
    const userAnswers: { [userId: string]: { user: any; answers: { [questionId: string]: string } } } = {};
    answers.forEach((answer) => {
      if (!userAnswers[answer.userId]) {
        userAnswers[answer.userId] = {
          user: answer.user,
          answers: {},
        };
      }
      const answerValue = answer.value || answer.options.join(', ');
      userAnswers[answer.userId].answers[answer.questionId] = answerValue;
    });

    // 4. Construir el CSV
    const headers = ['UserID', 'Nombre', 'Email', ...survey.questions.map((q) => `"${q.text.replace(/"/g, '""')}"`)];
    let csv = headers.join(',') + '\n';

    Object.values(userAnswers).forEach((userData) => {
      const row = [
        userData.user.id,
        `"${userData.user.name.replace(/"/g, '""')}"`,
        userData.user.email,
        ...survey.questions.map((q) => {
          const answerText = userData.answers[q.id] || '';
          return `"${answerText.replace(/"/g, '""')}"`; // Escapar comillas dobles
        }),
      ];
      csv += row.join(',') + '\n';
    });

    // 5. Enviar el archivo CSV
    const fileName = `resultados-${survey.title.replace(/\s/g, '_')}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Error al exportar los resultados de la encuesta:', error);
    res.status(500).json({ message: 'Error al exportar los resultados.' });
  }
};