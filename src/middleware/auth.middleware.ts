import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

// Extendemos la interfaz Request de Express para añadir nuestra propiedad `userId`
export interface AuthRequest extends Request { // This is a placeholder, the user's file is in the frontend project
  userId?: string;
}


export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: 'No se proporcionó token. Acceso denegado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    req.userId = decoded.id;
    next(); // El token es válido, continuar a la siguiente función (el controlador)
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido o expirado.' });
  }
};