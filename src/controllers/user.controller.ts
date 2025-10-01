import { Response } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';

export const getUsers = async (req: AuthRequest, res: Response) => {
  const adminId = req.userId;

  try {
    // Obtenemos todos los usuarios que no son el super-admin actual
    // para que puedan ser asignados como administradores de institución.
    const users = await prisma.user.findMany({
      where: {
        id: { not: adminId },
        role: { not: 'ADMIN' }, // Excluimos a otros super-admins
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error al obtener los usuarios:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};