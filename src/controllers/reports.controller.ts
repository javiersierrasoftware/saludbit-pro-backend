import { Response } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { Prisma } from '@prisma/client';

export const getSubmissionsByDay = async (req: AuthRequest, res: Response) => {
  // --- LOG DE DEPURACIÓN: VERIFICAR SI LA RUTA ESTÁ SIENDO ALCANZADA ---
  console.log(`\n📊 [getSubmissionsByDay] Petición recibida para el reporte de envíos.`);

  const adminId = req.userId;

  if (!adminId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  try {
    const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
    if (!adminUser || (adminUser.role !== 'ADMIN' && adminUser.role !== 'INSTITUTION_ADMIN')) {
      return res.status(403).json({ message: 'Acceso denegado.' });
    }

    const whereClause: Prisma.UserAnswerWhereInput = {
      // No filtramos por fecha para depurar y ver todos los datos
    };

    // Si es un admin de institución, filtramos por los estudiantes de su institución.
    if (adminUser.role === 'INSTITUTION_ADMIN') {
      if (adminUser.institutionId) {
        whereClause.user = { institutionId: adminUser.institutionId };
      }
    }

    // Obtenemos todas las respuestas con la información del usuario y del registro
    const allAnswers = await prisma.userAnswer.findMany({
      where: whereClause,
      include: {
        user: { select: { name: true, institutionId: true } }, // Incluimos institutionId para depurar
        question: { select: { survey: { select: { title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // --- LOG DE DEPURACIÓN ---
    console.log(`[getSubmissionsByDay] Consulta a la BD encontró ${allAnswers.length} respuestas.`);
    if (allAnswers.length > 0) {
      console.log('[getSubmissionsByDay] Ejemplo de respuesta encontrada:', JSON.stringify(allAnswers[0], null, 2));
    }
    // --- FIN LOG DE DEPURACIÓN ---

    // Formateamos los datos para que sean fáciles de consumir en el frontend
    const formattedData = allAnswers.map((answer) => ({
      studentName: answer.user.name,
      surveyName: answer.question.survey.title,
      submittedAt: answer.createdAt.toISOString(),
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    // Manejo de errores para la agregación
    console.error('Error al obtener los envíos por día:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};