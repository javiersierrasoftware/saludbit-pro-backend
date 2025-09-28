import { Request, Response } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { QuestionType } from '@prisma/client';

export const getAssignedSurveys = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  try {
    // Hacemos una consulta más robusta que filtra los datos inválidos en la base de datos.
    const assignments = await prisma.surveyAssignment.findMany({
      where: {
        userId,
        // Esta condición asegura que solo se incluyan asignaciones cuya encuesta
        // relacionada exista y tenga una fecha de inicio.
        // Esto previene errores con datos antiguos que no tienen este campo.
        survey: {
          startDate: {
            // Filtra cualquier cosa que no sea una fecha válida.
            // 'gt: new Date(0)' es una forma de decir "es una fecha".
            gt: new Date(0),
          },
        },
      },
      include: {
        survey: true, // Incluir los datos completos de la encuesta
      },
    });
    
    // Como el filtrado se hace en la BD, el mapeo ahora es más seguro.
    const surveys = assignments.map((assignment) => ({
      survey: assignment.survey,
      status: assignment.status,
      dueDate: assignment.dueDate.toISOString().split('T')[0], // Formatear fecha
    }));

    res.status(200).json(surveys);
  } catch (error) {
    console.error('Error al obtener encuestas asignadas:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const createSurvey = async (req: AuthRequest, res: Response) => {
  const { title, description, startDate, endDate } = req.body;
  const adminId = req.userId; // Obtenemos el ID del admin desde el token

  if (!title || !description || !startDate || !endDate) {
    return res.status(400).json({ message: 'Todos los campos son requeridos.' });
  }

  try {
    const newSurvey = await prisma.survey.create({
      data: {
        title,
        description,
        // Prisma espera fechas en formato ISO, que es lo que JSON.stringify hace por defecto.
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    // ¡Paso clave! Asignar automáticamente la encuesta al admin que la creó.
    if (adminId) {
      await prisma.surveyAssignment.create({
        data: {
          surveyId: newSurvey.id,
          userId: adminId,
          status: 'PENDING', // O el estado inicial que prefieras
          dueDate: new Date(endDate), // Usamos la fecha de cierre del formulario
        },
      });
    }

    res.status(201).json(newSurvey);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear la encuesta.' });
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
    res.status(200).json(questions);
  } catch (error) {
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