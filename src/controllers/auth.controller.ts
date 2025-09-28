import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/db';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response) => {
  const { email, password, name, institutionId } = req.body;

  // 1. Validar la entrada
  if (!email || !password || !name || !institutionId) {
    return res.status(400).json({ message: 'Por favor, proporciona email, contraseña, nombre e ID de la institución.' });
  }

  try {
    // 2. Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'El correo electrónico ya está en uso.' });
    }

    // 3. Verificar si la institución existe
    const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) {
      return res.status(404).json({ message: 'La institución proporcionada no existe.' });
    }

    // 4. Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Crear el nuevo usuario en la base de datos
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        institutionId,
      },
    });

    // 6. Enviar respuesta (sin la contraseña)
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ message: 'Usuario registrado con éxito', user: userWithoutPassword });
  } catch (error) {
    console.error('Error en el registro:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // 1. Validar la entrada
  if (!email || !password) {
    return res.status(400).json({ message: 'Por favor, proporciona email y contraseña.' });
  }

  try {
    // 2. Buscar al usuario por su correo electrónico
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        institution: true, // Incluir los datos de la institución
      },
    });
    if (!user) {
      // Usamos un mensaje genérico para no revelar si el email existe o no
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // 3. Comparar la contraseña proporcionada con la almacenada
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // 4. Generar el JSON Web Token (JWT)
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
      expiresIn: '7d', // El token expirará en 7 días
    });

    // 5. Enviar respuesta con los datos del usuario (sin contraseña) y el token
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({
      message: 'Inicio de sesión exitoso',
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};
