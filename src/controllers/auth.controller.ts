import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/db';
import { Role } from '@prisma/client';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña son requeridos.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

    // No devolvemos la contraseña
    const { password: _, ...userWithoutPassword } = user;

    res.status(200).json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const register = async (req: Request, res: Response) => {
  const { name, identification, phone, email, password, institutionId } = req.body;

  if (!name || !identification || !phone || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son requeridos.' });
  }

  try {
    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo electrónico ya está en uso.' });
    }

    // Busca la institución proporcionada o una por defecto. Si no existe, la crea.
    let institution;
    if (institutionId) {
      institution = await prisma.institution.findUnique({ where: { id: institutionId } });
      if (!institution) {
        return res.status(400).json({ message: 'La institución proporcionada no es válida.' });
      }
    } else {
      // Usamos upsert para crear la institución por defecto si no existe.
      // 'upsert' es una operación de 'update or insert'.
      institution = await prisma.institution.upsert({
        where: { name: 'Institución General' }, // Criterio para buscar
        update: {}, // No hay nada que actualizar si se encuentra
        create: { name: 'Institución General' }, // Datos para crear si no se encuentra
      });
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el nuevo usuario
    const newUser = await prisma.user.create({
      data: {
        name,
        identification,
        phone,
        email,
        password: hashedPassword,
        role: Role.STUDENT, // Todos los nuevos registros son estudiantes
        institutionId: institution.id,
      },
    });

    // No devolvemos la contraseña
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};