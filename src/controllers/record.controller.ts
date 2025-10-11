import { Request, Response } from 'express';
import { Record } from '../models/record.model';
import { User } from '../models/user.model';
import { Group } from '../models/group.model';
import { Process } from '../models/process.model';

// Create a new record (form template)
export const createRecord = async (req: Request, res: Response) => {
  try {
    const { name, questions } = req.body;
    const userId = (req as any).userId;

    if (!name || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Nombre y al menos una pregunta son requeridos.' });
    }

    const newRecord = new Record({
      name,
      questions,
      createdBy: userId,
    });

    let savedRecord = await newRecord.save();
    savedRecord = await savedRecord.populate('createdBy', '_id');
    return res.status(201).json(savedRecord);
  } catch (error) {
    console.error('Error al crear registro:', error);
    return res.status(500).json({ message: 'Error del servidor al crear el registro.' });
  }
};

// Get all records
export const getRecords = async (_req: Request, res: Response) => {
  const req = _req as Request; // Type assertion to access userId
  try {
    const userId = (req as any).userId as string;
    const user = await User.findById(userId).select('role');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (user.role === 'ADMIN') {
      // Admin gets all records they created
      const records = await Record.find({ createdBy: userId })
        .populate('createdBy', '_id')
        .sort({ createdAt: -1 });
      return res.status(200).json(records);
    } else {
      // Student gets records from their groups -> processes
      // 1. Find groups the student is in
      const studentGroups = await Group.find({ members: userId }).select('processes');
      if (studentGroups.length === 0) {
        return res.status(200).json([]);
      }

      // 2. Get all unique process IDs from those groups
      const processIds = [...new Set(studentGroups.flatMap(g => g.processes))];

      // 3. Find all processes with those IDs
      const processesWithRecords = await Process.find({ _id: { $in: processIds } }).select('records');
      if (processesWithRecords.length === 0) {
        return res.status(200).json([]);
      }

      // 4. Get all unique record IDs from those processes
      const recordIds = [...new Set(processesWithRecords.flatMap(p => p.records))];

      // 5. Find all records with those IDs
      const records = await Record.find({ _id: { $in: recordIds } })
        .sort({ createdAt: -1 });

      return res.status(200).json(records);
    }
  } catch (error) {
    console.error('Error al obtener registros:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener registros.' });
  }
};

// Update a record
export const updateRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, questions } = req.body;
    const userId = (req as any).userId;

    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({ message: 'Registro no encontrado.' });
    }

    if (record.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'No autorizado para editar este registro.' });
    }

    record.name = name || record.name;
    record.questions = questions || record.questions;

    let updatedRecord = await record.save();
    updatedRecord = await updatedRecord.populate('createdBy', '_id');
    return res.status(200).json(updatedRecord);
  } catch (error) {
    console.error('Error al actualizar registro:', error);
    return res.status(500).json({ message: 'Error del servidor al actualizar registro.' });
  }
};

// Delete a record
export const deleteRecord = async (req: Request, res: Response) => {
  try {
    const record = await Record.findById(req.params.id);
    if (!record || record.createdBy.toString() !== (req as any).userId) {
      return res.status(403).json({ message: 'No autorizado o registro no encontrado.' });
    }
    await Record.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'Registro eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    return res.status(500).json({ message: 'Error del servidor al eliminar registro.' });
  }
};

// Get a single record by ID
export const getRecordById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({ message: 'Registro no encontrado.' });
    }
    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ message: 'Error del servidor al obtener el registro.' });
  }
};