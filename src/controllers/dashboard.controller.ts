import { Response } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    let stats;

    if (user.role === 'ADMIN') {
      // Estadísticas para el Administrador General (sumatoria de todo)
      const [allStudentAnswers, allQuestions, totalSurveys, groupCount] = await prisma.$transaction([
        // Obtener todas las respuestas de todos los estudiantes
        prisma.userAnswer.findMany({
          where: { user: { role: 'STUDENT' } },
          include: { question: { select: { surveyId: true } } },
        }),
        // Obtener todas las preguntas para calcular el total por encuesta
        prisma.question.findMany({ select: { id: true, surveyId: true } }),
        // Total de registros en el sistema
        prisma.survey.count(), // Total de registros en el sistema
        // Total de grupos en el sistema
        prisma.group.count(),
      ]);

      // Calcular el número de preguntas por cada encuesta
      const surveyQuestionCounts = new Map<string, number>();
      allQuestions.forEach(q => {
        surveyQuestionCounts.set(q.surveyId, (surveyQuestionCounts.get(q.surveyId) || 0) + 1);
      });

      let completedCount = 0;
      // Agrupar respuestas por usuario y por encuesta para contar envíos completos
      const userSurveyAnswerCounts = new Map<string, Map<string, number>>(); // Map<userId, Map<surveyId, answerCount>>

      allStudentAnswers.forEach(answer => {
        const surveyId = answer.question.surveyId;
        if (!userSurveyAnswerCounts.has(answer.userId)) {
          userSurveyAnswerCounts.set(answer.userId, new Map<string, number>());
        }
        const surveyAnswers = userSurveyAnswerCounts.get(answer.userId)!;
        surveyAnswers.set(surveyId, (surveyAnswers.get(surveyId) || 0) + 1);
      });

      userSurveyAnswerCounts.forEach((surveyAnswers) => {
        surveyAnswers.forEach((answerCount, surveyId) => {
          const questionCount = surveyQuestionCounts.get(surveyId) || 0;
          if (questionCount > 0) {
            completedCount += Math.floor(answerCount / questionCount);
          }
        });
      });

      stats = { completedSurveys: completedCount, totalSurveys, groupCount };
    } else if (user.role === 'INSTITUTION_ADMIN') {
      // Estadísticas para el Administrador de Institución
      // 1. Encontrar todos los estudiantes de su institución
      const [institutionStudentAnswers, institutionQuestions, totalSurveys, groupCount] = await prisma.$transaction([
        // Obtener todas las respuestas de los estudiantes de esta institución
        prisma.userAnswer.findMany({
          where: { user: { institutionId: user.institutionId, role: 'STUDENT' } },
          include: { question: { select: { surveyId: true } } },
        }),
        // Obtener todas las preguntas de las encuestas de esta institución
        prisma.question.findMany({
          where: { survey: { institutionId: user.institutionId } },
          select: { id: true, surveyId: true }
        }),
        // Total de registros creados en su institución
        prisma.survey.count({ where: { institutionId: user.institutionId } }),
        // Grupos creados por este administrador de institución
        prisma.group.count({ where: { creatorId: userId } }),
      ]);

      // Calcular el número de preguntas por cada encuesta relevante
      const surveyQuestionCounts = new Map<string, number>();
      institutionQuestions.forEach(q => {
        surveyQuestionCounts.set(q.surveyId, (surveyQuestionCounts.get(q.surveyId) || 0) + 1);
      });

      let completedCount = 0;
      const userSurveyAnswerCounts = new Map<string, Map<string, number>>(); // Map<userId, Map<surveyId, answerCount>>

      institutionStudentAnswers.forEach(answer => {
        const surveyId = answer.question.surveyId;
        if (!userSurveyAnswerCounts.has(answer.userId)) {
          userSurveyAnswerCounts.set(answer.userId, new Map<string, number>());
        }
        const surveyAnswers = userSurveyAnswerCounts.get(answer.userId)!;
        surveyAnswers.set(surveyId, (surveyAnswers.get(surveyId) || 0) + 1);
      });

      userSurveyAnswerCounts.forEach((surveyAnswers) => {
        surveyAnswers.forEach((answerCount, surveyId) => {
          const questionCount = surveyQuestionCounts.get(surveyId) || 0;
          if (questionCount > 0) {
            completedCount += Math.floor(answerCount / questionCount);
          }
        });
      });

      stats = { completedSurveys: completedCount, totalSurveys, groupCount };
    } else {
      // Estadísticas para el Estudiante (lógica original)
      const [assignments, groups] = await prisma.$transaction([
        // Total de registros asignados al estudiante
        prisma.surveyAssignment.findMany({ where: { userId } }),
        prisma.usersOnGroups.count({
          where: { userId },
        }),
      ]);

      // Contamos cuántas veces se ha respondido cada encuesta asignada.
      let completedCount = 0;
      for (const assignment of assignments) {
        const answerCount = await prisma.userAnswer.count({
          where: { userId, question: { surveyId: assignment.surveyId } },
        });
        const questionCount = await prisma.question.count({ where: { surveyId: assignment.surveyId } });
        if (questionCount > 0) {
          completedCount += Math.floor(answerCount / questionCount);
        }
      }

      stats = { completedSurveys: completedCount, availableSurveys: assignments.length, groupCount: groups };
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error('Error al obtener las estadísticas del dashboard:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};