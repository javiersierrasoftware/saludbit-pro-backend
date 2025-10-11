import { Request, Response } from 'express';
import { Institution } from '../models/institution.model';
import { User } from '../models/user.model';

// Crear institución (solo ADMIN)
export const createInstitution = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const userId = (req as any).userId; // lo seteamos desde el middleware de auth

    const user = await User.findById(userId);
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const existing = await Institution.findOne({ name });
    if (existing) {
      return res.status(400).json({ message: 'La institución ya existe' });
    }

    const institution = new Institution({
      name,
      description,
      createdBy: userId,
    });

    const savedInstitution = await institution.save();

    // ✨ Asignar la nueva institución al usuario que la creó
    user.institution = (savedInstitution as any)._id;
    const updatedUser = await user.save();

    return res.status(201).json({
      message: 'Institución creada exitosamente',
      institution: savedInstitution,
      user: updatedUser, // 🚀 Devolver el usuario actualizado
    });
  } catch (error) {
    console.error('Error al crear institución:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

// Actualizar una institución (solo ADMIN)
export const updateInstitution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = (req as any).userId;

    const institution = await Institution.findById(id);
    if (!institution) {
      return res.status(404).json({ message: 'Institución no encontrada' });
    }

    // Opcional: verificar si el usuario es el creador o un super-admin
    if (institution.createdBy.toString() !== userId) {
      const user = await User.findById(userId);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'No autorizado para editar esta institución' });
      }
    }

    institution.name = name || institution.name;
    institution.description = description || institution.description;

    const updatedInstitution = await institution.save();
    return res.status(200).json(updatedInstitution);
  } catch (error) {
    console.error('Error al actualizar institución:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

// Obtener todas las instituciones
export const getInstitutions = async (_req: Request, res: Response) => {
  try {
    const institutions = await Institution.find().populate('createdBy', 'name email role');
    return res.status(200).json(institutions);
  } catch (error) {
    console.error('Error al obtener instituciones:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};