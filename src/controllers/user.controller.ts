import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Group } from '../models/group.model';
import { Institution } from '../models/institution.model';

// Actualizar institución de un usuario
export const updateInstitution = async (req: Request, res: Response) => {
  try {
    const { institutionName } = req.body;
    const { id } = req.params; // id del usuario

    // Buscar usuario
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Buscar institución por nombre
    const foundInstitution = await Institution.findOne({ name: institutionName });
    if (!foundInstitution) {
      return res.status(404).json({ message: 'Institución no encontrada' });
    }

    // Asignar directamente el ObjectId de la institución
    user.institution = (foundInstitution as any)._id;
    await user.save();

    return res.status(200).json({
      message: 'Institución actualizada correctamente',
      user,
    });
  } catch (error) {
    console.error('Error en updateInstitution:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

// Obtener usuarios por institución
export const getUsersByInstitution = async (req: Request, res: Response) => {
  try {
    const { institutionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(institutionId)) {
      return res.status(400).json({ message: 'ID de institución inválido' });
    }

    const users = await User.find({ institution: institutionId }).select(
      'name email role document phone status'
    );

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error en getUsersByInstitution:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};

// Actualizar el rol de un usuario
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validar que el rol sea uno de los permitidos
    if (!['ADMIN', 'STUDENT', 'SIN_ROL'].includes(role)) {
      return res.status(400).json({ message: 'El rol proporcionado no es válido.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    user.role = role;
    await user.save();

    return res.status(200).json({ message: 'Rol actualizado correctamente.' });
  } catch (error) {
    console.error('Error al actualizar el rol:', error);
    return res.status(500).json({ message: 'Error del servidor al actualizar el rol.' });
  }
};

// Eliminar la cuenta de un usuario
export const deleteUserAccount = async (req: Request, res: Response) => {
  try {
    const userIdFromToken = (req as any).userId;
    const { id } = req.params;

    // Medida de seguridad: un usuario solo puede eliminar su propia cuenta.
    if (userIdFromToken !== id) {
      return res.status(403).json({ message: 'No autorizado para realizar esta acción.' });
    }

    // Opcional: Limpiar datos relacionados (ej. remover al usuario de los grupos)
    await Group.updateMany({ members: id }, { $pull: { members: id } });

    // Eliminar el usuario
    await User.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Tu cuenta ha sido eliminada permanentemente.' });
  } catch (error) {
    console.error('Error al eliminar la cuenta:', error);
    return res.status(500).json({ message: 'Error del servidor al eliminar la cuenta.' });
  }
};