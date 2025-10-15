import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Group } from '../models/group.model';
import { User } from '../models/user.model';

// Función auxiliar para generar código aleatorio
const generateGroupCode = (): string => {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `PRO-${random}`;
};

// Crear un nuevo grupo
export const createGroup = async (req: Request, res: Response) => {
  try {
    const { name, description, tutor, processIds } = req.body;
    const userId = (req as any).userId as string;

    const adminUser = await User.findById(userId).select('institution');
    if (!adminUser || !adminUser.institution) {
      return res.status(400).json({ message: 'No puedes crear un grupo sin estar asignado a una institución.' });
    }

    if (!name || !userId) {
      return res.status(400).json({ message: 'Faltan datos requeridos.' });
    }

    // Generar un código único y verificar que no exista en la BD
    let code: string;
    let isCodeUnique = false;
    do {
      code = generateGroupCode();
      const existingGroup = await Group.findOne({ code });
      if (!existingGroup) {
        isCodeUnique = true;
      }
    } while (!isCodeUnique);

    const newGroup = new Group({
      name,
      description,
      tutor,
      code,
      institution: adminUser.institution,
      processes: processIds || [],
      createdBy: userId,
      members: [userId], // El creador se agrega como primer miembro
    });

    const savedGroup = await newGroup.save();
    // Populamos el campo createdBy para que la respuesta sea consistente
    await savedGroup.populate('createdBy', 'name _id');
    await savedGroup.populate('processes', 'name code');

    return res.status(201).json(savedGroup);
  } catch (error) {
    console.error('Error al crear grupo:', error);
    return res.status(500).json({ message: 'Error del servidor al crear grupo.' });
  }
};

// Obtener todos los grupos
export const getGroups = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const user = await User.findById(userId).select('role institution');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    let query: any = {};
    if (user.role === 'STUDENT') {
      query = { members: userId };
    } else if (user.role === 'ADMIN' && user.institution) {
      query = { institution: user.institution };
    }

    const groups = await Group.find(query)
      .populate('createdBy', 'name email _id') // ✅ Añadido _id para la comprobación en el frontend
      .populate('processes', 'name code')
      .sort({ createdAt: -1 });

    return res.status(200).json(groups);
  } catch (error) {
    console.error('Error al obtener grupos:', error);
    return res.status(500).json({ message: 'Error del servidor al obtener grupos.' });
  }
};

// Actualizar un grupo
export const updateGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, tutor, processIds } = req.body;
    const userId = (req as any).userId as string;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado.' });
    }

    if (group.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'No autorizado para editar este grupo.' });
    }

    group.name = name || group.name;
    group.tutor = tutor || group.tutor;
    if (processIds) {
      group.processes = processIds;
    }

    let updatedGroup = await group.save();
    // Populamos el campo createdBy para que la respuesta sea consistente
    await updatedGroup.populate('createdBy', 'name _id');
    await updatedGroup.populate('processes', 'name code');

    return res.status(200).json(updatedGroup);
  } catch (error) {
    console.error('Error al actualizar grupo:', error);
    return res.status(500).json({ message: 'Error del servidor al actualizar grupo.' });
  }
};

// Eliminar un grupo
export const deleteGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId as string;

    const group = await Group.findById(id);
    if (!group || group.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'No autorizado o grupo no encontrado.' });
    }

    await Group.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Grupo eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar grupo:', error);
    return res.status(500).json({ message: 'Error del servidor al eliminar grupo.' });
  }
};

// Unirse a un grupo con un código
export const joinGroup = async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    const userId = (req as any).userId as string;

    if (!code) {
      return res.status(400).json({ message: 'El código del grupo es requerido.' });
    }

    const group = await Group.findOne({ code: code.toUpperCase() });
    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado con ese código.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Si el usuario es SIN_ROL, se convierte en ESTUDIANTE y se le asigna la institución.
    if (user.role === 'SIN_ROL') {
      user.role = 'STUDENT';
      user.institution = group.institution;
    }

    // Si el grupo estaba desactivado, lo reactivamos.
    user.deactivatedGroupIds = user.deactivatedGroupIds?.filter((id: Types.ObjectId) => !id.equals(group._id as Types.ObjectId));

    await user.save();

    if (group.members.includes(userId as any) && !req.body.isRejoin) {
      return res.status(400).json({ message: 'Ya eres miembro activo de este grupo.' });
    }


    // Añadimos al estudiante a la lista de miembros y guardamos el grupo.
    group.members.push(userId as any);
    await group.save();

    // Populamos los campos necesarios para que el frontend renderice la tarjeta correctamente
    const populatedGroup = await Group.findById(group._id).populate('createdBy', 'name _id').populate('processes', 'name code');

    return res.status(200).json({ message: 'Te has unido al grupo exitosamente.', group: populatedGroup, user: await User.findById(userId).populate('institution', 'name') });
  } catch (error) {
    console.error('Error al unirse al grupo:', error);
    return res.status(500).json({ message: 'Error del servidor al unirse al grupo.' });
  }
};

// Abandonar un grupo
export const leaveGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // ID del grupo
    const userId = (req as any).userId as string;

    const group = await Group.findById(id);
    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado.' });
    }

    // Regla: El creador no puede abandonar su propio grupo, solo eliminarlo.
    if (group.createdBy.toString() === userId) {
      return res.status(400).json({ message: 'El creador no puede abandonar el grupo. Solo puede eliminarlo.' });
    }

    if (!group.members.map(id => id.toString()).includes(userId)) {
      return res.status(400).json({ message: 'No eres miembro de este grupo.' });
    }

    // En lugar de eliminarlo, lo añadimos a la lista de grupos desactivados del usuario.
    await User.findByIdAndUpdate(userId, { $addToSet: { deactivatedGroupIds: id } });

    return res.status(200).json({ message: 'Has desactivado el grupo correctamente.' });
  } catch (error) {
    console.error('Error al abandonar el grupo:', error);
    return res.status(500).json({ message: 'Error del servidor al abandonar el grupo.' });
  }
};