import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Group } from '../models/group.model';
import { Record } from '../models/record.model';
import { User } from '../models/user.model';

/**
 * Crea un nuevo registro.
 */
export const createRecord = async (req: Request, res: Response) => {
  try {
    const { name, questions } = req.body;
    const userId = (req as any).userId;

    const adminUser = await User.findById(userId).select('institution');
    if (!adminUser || !adminUser.institution) {
      return res.status(400).json({ message: 'No puedes crear un registro sin estar asignado a una institución.' });
    }

    if (!name || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'El nombre y al menos una pregunta son requeridos.' });
    }

    const newRecord = new Record({
      name,
      questions,
      institution: adminUser.institution,
      createdBy: userId,
    });

    const savedRecord = await newRecord.save();
    return res.status(201).json(savedRecord);
  } catch (error) {
    return res.status(500).json({ message: 'Error del servidor al crear el registro.' });
  }
};

/**
 * Obtiene todos los registros.
 * En el futuro, se podría filtrar para que un ADMIN solo vea los que ha creado.
 */
export const getRecords = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await User.findById(userId).select('institution');

    if (!user || !user.institution) {
      return res.status(200).json([]); // Si no tiene institución, no ve registros.
    }

    const records = await Record.find({ institution: user.institution })
      .populate('createdBy', 'name _id')
      .sort({ createdAt: -1 });
    return res.status(200).json(records);
  } catch (error) {
    console.error('Error al obtener registros:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener registros.' });
  }
};

/**
 * Obtiene un registro específico por su ID.
 */
export const getRecordById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = await Record.findById(id);
    if (!record) {
      return res.status(404).json({ message: 'Registro no encontrado.' });
    }
    return res.status(200).json(record);
  } catch (error) {
    console.error('Error al obtener registro por ID:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener el registro.' });
  }
};

/**
 * Actualiza un registro existente.
 */
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

    const updatedRecord = await record.save();
    return res.status(200).json(updatedRecord);
  } catch (error) {
    return res.status(500).json({ message: 'Error del servidor al actualizar el registro.' });
  }
};

/**
 * Elimina un registro.
 */
export const deleteRecord = async (req: Request, res: Response) => {
  try {
    await Record.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'Registro eliminado correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error del servidor al eliminar el registro.' });
  }
};

/**
 * Obtiene las "asignaciones" de registros para un estudiante.
 * Una asignación es un registro que debe ser completado en el contexto de un grupo y un proceso.
 */
export const getStudentAssignments = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await User.findById(userId).select('deactivatedGroupIds');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const deactivatedGroupIds = user.deactivatedGroupIds?.map(id => id.toString()) || [];

    // 1. Encontrar todos los grupos a los que pertenece el estudiante.
    //    Poblamos en cascada: Grupo -> Procesos -> Registros
    const userGroups = await Group.find({ members: userId })
      .populate({
        path: 'processes',
        populate: {
          path: 'records',
          model: 'Record',
        },
      })
      .select('name processes'); // Seleccionamos solo los campos necesarios

    // 2. Transformar los datos en una lista plana de "asignaciones"
    const assignments: any[] = [];
    userGroups.forEach((group: any) => {
      const isActive = !deactivatedGroupIds.includes(group._id.toString());

      group.processes.forEach((process: any) => {
        process.records.forEach((record: any) => {
          assignments.push({
            _id: `${group._id}-${process._id}-${record._id}`, // ID único para la asignación
            group: { _id: group._id, name: group.name },
            process: { _id: process._id, name: process.name },
            record: record.toObject(), // Convertimos el documento de Mongoose a un objeto plano
            isActive, // Añadimos el estado de actividad
          });
        });
      });
    });

    return res.status(200).json(assignments);
  } catch (error) {
    console.error('Error al obtener asignaciones del estudiante:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener asignaciones.' });
  }
};