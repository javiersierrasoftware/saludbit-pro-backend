import { Response } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

export const createInstitution = async (req: AuthRequest, res: Response) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'El nombre de la institución es requerido.' });
  }

  try {
    const existingInstitution = await prisma.institution.findUnique({ where: { name } });
    if (existingInstitution) {
      return res.status(409).json({ message: 'Ya existe una institución con este nombre.' });
    }

    const newInstitution = await prisma.institution.create({
      data: { name },
    });

    res.status(201).json(newInstitution);
  } catch (error) {
    console.error('Error al crear la institución:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const assignAdminsToInstitution = async (req: AuthRequest, res: Response) => {
  const { institutionId } = req.params;
  const { adminIds } = req.body; // Array de IDs de usuarios a asignar como admins
  const superAdminId = req.userId;

  if (!superAdminId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }
  if (!Array.isArray(adminIds)) {
    return res.status(400).json({ message: 'Se requiere un array de IDs de administradores.' });
  }

  try {
    // 1. Verificar que la institución existe.
    const institution = await prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) {
      return res.status(404).json({ message: 'Institución no encontrada.' });
    }

    // 2. Obtener los administradores actuales de esta institución.
    const currentAdmins = await prisma.user.findMany({
      where: {
        institutionId,
        role: Role.INSTITUTION_ADMIN,
      },
      select: { id: true },
    });
    const currentAdminIds = new Set(currentAdmins.map(admin => admin.id));

    // 3. Identificar administradores a añadir y a remover.
    const newAdminIds = new Set(adminIds);

    const adminsToAdd = Array.from(newAdminIds).filter(id => !currentAdminIds.has(id));
    const adminsToRemove = Array.from(currentAdminIds).filter(id => !newAdminIds.has(id));

    await prisma.$transaction(async (tx) => {
      // Asignar nuevos administradores: cambiar su rol y institutionId.
      if (adminsToAdd.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: adminsToAdd } },
          data: { role: Role.INSTITUTION_ADMIN, institutionId: institution.id },
        });
      }

      // Remover administradores: cambiar su rol a STUDENT y limpiar institutionId (o asignar a una por defecto si es necesario).
      if (adminsToRemove.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: adminsToRemove } },
          data: { role: Role.STUDENT, institutionId: null }, // O asignar a una institución por defecto si es el caso
        });
      }
    });

    res.status(200).json({ message: 'Administradores de institución actualizados correctamente.' });
  } catch (error) {
    console.error('Error al asignar administradores a la institución:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const getInstitutions = async (req: AuthRequest, res: Response) => {
  try {
    const institutions = await prisma.institution.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        users: {
          where: {
            role: 'INSTITUTION_ADMIN',
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    res.status(200).json(institutions);
  } catch (error) {
    console.error('Error al obtener las instituciones:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};