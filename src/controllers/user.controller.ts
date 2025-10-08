import { Response } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';

export const getUsers = async (req: AuthRequest, res: Response) => {
  const adminId = req.userId;

  try {
    // Obtenemos todos los usuarios que no son el super-admin actual
    // para que puedan ser asignados como administradores de institución.
    const users = await prisma.user.findMany({
      where: {
        id: { not: adminId },
        role: { not: 'ADMIN' }, // Excluimos a otros super-admins
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const getSubmissionHistory = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  try {
    // 1. Obtener todas las respuestas del usuario
    const userAnswers = await prisma.userAnswer.findMany({
      where: { userId },
      include: {
        question: {
          select: {
            survey: {
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 2. Agrupar respuestas por envío (usando la fecha de creación)
    // Asumimos que las respuestas enviadas juntas tienen una fecha de creación muy cercana.
    // Esta es una simplificación. Un modelo 'Submission' sería más robusto.
    const submissions = userAnswers.map(answer => ({
      surveyName: answer.question.survey.title,
      submittedAt: answer.createdAt,
    }));

    res.status(200).json(submissions);
  } catch (error) {
    console.error('Error al obtener el historial de envíos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};