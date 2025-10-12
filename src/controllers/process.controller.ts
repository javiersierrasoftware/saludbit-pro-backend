import { Request, Response } from 'express';
import { Process } from '../models/process.model';
import { User } from '../models/user.model';

// Crear un nuevo proceso
export const createProcess = async (req: Request, res: Response) => {
  try {
    const { name, type, groupIds, recordIds } = req.body;
    const userId = (req as any).userId;

    const adminUser = await User.findById(userId).select('institution');
    if (!adminUser || !adminUser.institution) {
      return res.status(400).json({ message: 'No puedes crear un proceso sin estar asignado a una institución.' });
    }

    if (!name || !type) {
      return res.status(400).json({ message: 'El nombre y el tipo son requeridos.' });
    }

    const newProcess = new Process({
      name,
      type,
      institution: adminUser.institution,
      groups: groupIds || [], // Array de IDs de grupos
      records: recordIds || [],
      createdBy: userId,
    });

    let savedProcess = await newProcess.save();
    // Populamos el campo createdBy para que la respuesta sea consistente
    savedProcess = await savedProcess.populate('createdBy', 'name _id');
    return res.status(201).json(savedProcess);
  } catch (error) {
    console.error('Error al crear proceso:', error);
    return res.status(500).json({ message: 'Error del servidor al crear el proceso.' });
  }
};

// Obtener todos los procesos
export const getProcesses = async (_req: Request, res: Response) => {
  try {
    const processes = await Process.find()
      .populate('groups', 'name')
      .populate('records', 'name code')
      .populate('createdBy', 'name _id');
    return res.status(200).json(processes);
  } catch (error) {
    console.error('Error al obtener procesos:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener procesos.' });
  }
};

// Actualizar un proceso
export const updateProcess = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, groupIds, recordIds } = req.body;
    const userId = (req as any).userId;

    const process = await Process.findById(id);
    if (!process) {
      return res.status(404).json({ message: 'Proceso no encontrado.' });
    }

    if (process.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'No autorizado para editar este proceso.' });
    }

    process.name = name || process.name;
    process.type = type || process.type;
    if (groupIds) {
      process.groups = groupIds;
    }
    if (recordIds) {
      process.records = recordIds;
    }

    let updatedProcess = await process.save();
    // Populamos el campo createdBy para que la respuesta sea consistente con getProcesses
    updatedProcess = await updatedProcess.populate('createdBy', 'name _id');
    updatedProcess = await updatedProcess.populate('records', 'name code');
    return res.status(200).json(updatedProcess);
  } catch (error) {
    console.error('Error al actualizar proceso:', error);
    return res.status(500).json({ message: 'Error del servidor al actualizar proceso.' });
  }
};

// Eliminar un proceso
export const deleteProcess = async (req: Request, res: Response) => {
  try {
    const process = await Process.findById(req.params.id);
    if (!process || process.createdBy.toString() !== (req as any).userId) {
      return res.status(403).json({ message: 'No autorizado o proceso no encontrado.' });
    }
    await Process.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'Proceso eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar proceso:', error);
    return res.status(500).json({ message: 'Error del servidor al eliminar proceso.' });
  }
};