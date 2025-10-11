import { Request, Response } from 'express';
import { Submission } from '../models/submission.model';

// Create a new submission
export const createSubmission = async (req: Request, res: Response) => {
  try {
    const { recordId, answers } = req.body;
    const studentId = (req as any).userId;

    if (!recordId || !answers) {
      return res.status(400).json({ message: 'Faltan datos para la sumisión.' });
    }

    const submission = new Submission({
      record: recordId,
      student: studentId,
      answers,
    });

    await submission.save();
    res.status(201).json({ message: 'Respuestas guardadas exitosamente.' });
  } catch (error) {
    console.error('Error al guardar respuestas:', error);
    res.status(500).json({ message: 'Error del servidor.' });
  }
};

// Get submission history for a student and a record
export const getSubmissionHistory = async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const studentId = (req as any).userId;

    const history = await Submission.find({
      record: recordId,
      student: studentId,
    })
      .select('createdAt answers') // Seleccionamos solo los campos necesarios
      .sort({ createdAt: -1 });

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor al obtener el historial.' });
  }
};