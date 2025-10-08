import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/db';
import { Role } from '@prisma/client';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

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

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // No revelamos si el usuario existe o no por seguridad
      return res.status(200).json({ message: 'Si existe una cuenta con este correo, se ha enviado un enlace de recuperación.' });
    }

    // Generar token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.user.update({
      where: { email },
      data: { passwordResetToken, passwordResetExpires },
    });

    // Enviar correo
    // Usamos un enlace universal de Expo para máxima compatibilidad.
    // Reemplaza '96ff1aa2-ec85-4b38-aaec-f847b5fec00f' con tu Project ID de EAS si es diferente.
    const resetURL = `https://exp.host/@javiersierrasoftware/saludbit-pro/--/reset-password?token=${resetToken}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: true, // true para el puerto 465 (SSL), false para otros
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: '"SaludBit Pro" <no-reply@saludbit.com>',
      to: user.email,
      subject: 'Recuperación de Contraseña',
      html: `<p>Has solicitado recuperar tu contraseña. Por favor, haz clic en el siguiente enlace para establecer una nueva:</p><p><a href="${resetURL}">${resetURL}</a></p><p>Si no solicitaste esto, por favor ignora este correo.</p>`,
    });

    res.status(200).json({ message: 'Si existe una cuenta con este correo, se ha enviado un enlace de recuperación.' });
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: 'Token y nueva contraseña son requeridos.' });
  }

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'El token es inválido o ha expirado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    res.status(200).json({ message: 'Contraseña actualizada con éxito.' });
  } catch (error) {
    console.error('Error en resetPassword:', error);
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