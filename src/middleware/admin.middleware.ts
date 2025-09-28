import { Response, NextFunction } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from './auth.middleware';

export const verifyAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
    }

    next(); // El usuario es admin, continuar.
  } catch (error) {
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
