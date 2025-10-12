import { Request, Response } from 'express';
import { Submission } from '../models/submission.model';

// Create a new submission
export const createSubmission = async (req: Request, res: Response) => {
  try {
    const { recordId, groupId, processId, answers } = req.body;
    const studentId = (req as any).userId;

    if (!recordId || !groupId || !processId || !answers) {
      return res.status(400).json({ message: 'Faltan datos para la sumisión.' });
    }

    const submission = new Submission({
      record: recordId,
      group: groupId,
      process: processId,
      student: studentId,
      answers,
    });

    await submission.save();
    res.status(201).json({ message: 'Respuestas guardadas exitosamente.' });
  } catch (error) {
    console.error('Error al guardar respuestas:', error);
    res.status(500).json({ message: 'Error del servidor al guardar las respuestas.' });
  }
};

// Get submission history for a student and a record
export const getSubmissionHistory = async (req: Request, res: Response) => {
  try {
    const { recordId, groupId, processId } = req.query;
    const studentId = (req as any).userId;

    const query: any = {
      record: recordId,
      student: studentId,
    };

    if (groupId) query.group = groupId;
    if (processId) query.process = processId;

    const history = await Submission.find(query)
      .select('createdAt answers')
      .sort({ createdAt: -1 });

    res.status(200).json(history);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ message: 'Error del servidor al obtener el historial.' });
  }
};