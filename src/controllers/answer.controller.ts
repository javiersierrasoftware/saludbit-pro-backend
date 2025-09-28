import { Response } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';

interface AnswerPayload {
  questionId: string;
  value?: string; // Para preguntas de texto
  options?: string[]; // Para preguntas de selección
}

export const submitAnswers = async (req: AuthRequest, res: Response) => {
  const { surveyId } = req.params;
  const userId = req.userId;
  const answers: AnswerPayload[] = req.body.answers;

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ message: 'Se requiere un array de respuestas.' });
  }

  try {
    // Usamos una transacción para asegurar que todas las operaciones se completen con éxito.
    await prisma.$transaction(async (tx) => {
      // 1. Guardar cada una de las respuestas.
      for (const answer of answers) {
        await tx.userAnswer.create({
          data: {
            questionId: answer.questionId,
            userId: userId,
            value: answer.value,
            options: answer.options,
          },
        });
      }

      // 2. Actualizar el estado de la asignación de la encuesta a 'COMPLETED'.
      await tx.surveyAssignment.update({
        where: { userId_surveyId: { userId, surveyId } },
        data: { status: 'COMPLETED' },
      });
    });

    res.status(201).json({ message: 'Encuesta completada exitosamente.' });
  } catch (error) {
    console.error('Error al guardar las respuestas:', error);
    res.status(500).json({ message: 'Error al guardar las respuestas.' });
  }
};