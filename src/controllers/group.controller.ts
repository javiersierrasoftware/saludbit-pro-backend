import { Response } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { getGroupSurveyAssignments } from './assignment.controller';

// Función para generar un código de invitación único y legible
const generateInvitationCode = (length = 6) => {
  const prefix = 'PRO-';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Caracteres legibles, sin 0, O, 1, I
  let randomPart = '';
  for (let i = 0; i < length; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + randomPart;
};

export const createGroup = async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  const creatorId = req.userId;

  // --- LOG DE RASTREO: VERIFICAR LA PETICIÓN PARA CREAR GRUPO ---
  console.log(`\n📦 [createGroup] Petición para crear grupo del usuario con ID: ${creatorId}`);
  console.log(`   => Datos recibidos:`, { name, description });

  if (!creatorId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  if (!name) {
    return res.status(400).json({ message: 'El nombre del grupo es requerido.' });
  }

  try {
    const admin = await prisma.user.findUnique({ where: { id: creatorId } });
    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'INSTITUTION_ADMIN')) {
      return res.status(403).json({ message: 'No tienes permisos para crear grupos.' });
    }

    // Generar un código único que no exista en la base de datos
    let invitationCode: string = '';
    let isCodeUnique = false;
    while (!isCodeUnique) {
      invitationCode = generateInvitationCode();
      const existingGroup = await prisma.group.findUnique({ where: { invitationCode } });
      if (!existingGroup) {
        isCodeUnique = true;
      }
    }

    const newGroup = await prisma.group.create({
      data: { name, description, invitationCode, creatorId, institutionId: admin.institutionId },
    });

    res.status(201).json(newGroup);
  } catch (error) {
    console.error('Error al crear el grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const joinGroup = async (req: AuthRequest, res: Response) => {
  const { invitationCode } = req.body;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  if (!invitationCode) {
    return res.status(400).json({ message: 'El código de invitación es requerido.' });
  }

  try {
    const group = await prisma.group.findUnique({
      where: { invitationCode: invitationCode.trim().toUpperCase() },
    });

    if (!group) {
      return res.status(404).json({ message: 'El código de invitación no es válido.' });
    }

    // Usamos upsert para evitar errores si el usuario ya es miembro.
    // 'upsert' intenta actualizar, y si no puede, crea un nuevo registro.
    await prisma.usersOnGroups.upsert({
      where: { userId_groupId: { userId, groupId: group.id } },
      update: {}, // No hay nada que actualizar si ya existe.
      create: { userId, groupId: group.id },
    });

    // --- NUEVA LÓGICA: Asignar encuestas existentes del grupo al nuevo miembro ---
    // 1. Encontrar los registros vinculados directamente al grupo.
    const surveysOnGroup = await prisma.surveysOnGroups.findMany({
      where: { groupId: group.id },
      include: { survey: true },
    });

    if (surveysOnGroup.length > 0) {
      // 2. Asignar esos registros al nuevo miembro usando `upsert` para evitar duplicados.
      // `skipDuplicates` en `createMany` no es compatible con MongoDB.
      await prisma.$transaction(
        surveysOnGroup.map(({ survey }) =>
          prisma.surveyAssignment.upsert({
            where: { userId_surveyId: { userId, surveyId: survey.id } },
            update: {}, // No hacer nada si la asignación ya existe.
            create: {
              userId, surveyId: survey.id, dueDate: survey.endDate, status: 'PENDING',
            },
          })
        )
      );
    }
    // --- FIN DE LA NUEVA LÓGICA ---

    res.status(200).json({ message: `Te has unido al grupo "${group.name}" con éxito.` });
  } catch (error) {
    console.error('Error al unirse al grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const getGroups = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    let groups;
    if (user.role === 'ADMIN') {
      // El admin general ve TODOS los grupos de la plataforma.
      groups = await prisma.group.findMany({
        // Sin cláusula 'where' para traerlos todos.
        include: {
          _count: {
            select: { members: true },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (user.role === 'INSTITUTION_ADMIN') {
      // El admin de institución solo ve los grupos que ha creado.
      groups = await prisma.group.findMany({
        where: { creatorId: userId },
        include: {
          _count: {
            select: { members: true },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Si es estudiante, devuelve los grupos a los que pertenece.
      const userGroups = await prisma.usersOnGroups.findMany({
        where: { userId },
        include: {
          group: {
            include: { _count: { select: { members: true } } },
          },
        },
      });
      groups = userGroups.map(ug => ug.group);
    }

    res.status(200).json(groups);
  } catch (error) {
    console.error('Error al obtener los grupos:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const deleteGroup = async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  try {
    // 1. Verificar que el grupo existe y que el usuario es el creador.
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado.' });
    }

    if (group.creatorId !== userId) {
      return res.status(403).json({ message: 'No tienes permisos para eliminar este grupo.' });
    }

    // 2. Eliminar el grupo. Gracias a `onDelete: Cascade` en el schema,
    // las membresías en `UsersOnGroups` se borrarán automáticamente.
    await prisma.group.delete({ where: { id: groupId } });

    res.status(204).send(); // 204 No Content: Éxito, sin contenido que devolver.
  } catch (error) {
    console.error('Error al eliminar el grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

export const assignSurveysToGroup = async (req: AuthRequest, res: Response) => {
  const { groupId } = req.params;
  const { surveyIds } = req.body; // Array de IDs de encuestas

  if (!Array.isArray(surveyIds)) {
    return res.status(400).json({ message: 'Se requiere un array de IDs de encuestas.' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Vincular las encuestas al grupo usando `upsert` para evitar duplicados.
      // `skipDuplicates` en `createMany` no es compatible con MongoDB.
      await Promise.all(
        surveyIds.map(surveyId =>
          tx.surveysOnGroups.upsert({
            where: { surveyId_groupId: { surveyId, groupId } },
            update: {}, // No hacer nada si ya existe
            create: { surveyId, groupId },
          })
        )
      );

      // 2. Encontrar todos los miembros actuales del grupo.
      const members = await tx.usersOnGroups.findMany({
        where: { groupId },
        select: { userId: true },
      });
      const memberIds = members.map(m => m.userId);

      if (memberIds.length === 0) {
        return; // No hay miembros a quienes asignar, pero el vínculo grupo-encuesta ya se creó.
      }

      // 3. Para cada encuesta, asignarla a los miembros que aún no la tengan.
      for (const surveyId of surveyIds) {
        const survey = await tx.survey.findUnique({ where: { id: surveyId } });
        if (!survey) continue;

        // Usamos upsert para cada miembro para evitar errores de duplicados.
        await Promise.all(
          memberIds.map(userId =>
            tx.surveyAssignment.upsert({
              where: { userId_surveyId: { userId, surveyId } },
              update: {}, // No hacer nada si ya existe
              create: { userId, surveyId, dueDate: survey.endDate, status: 'PENDING' },
            })
          )
        );
      }
    });

    res.status(200).json({ message: 'Registros asignados correctamente al grupo y a sus miembros.' });
  } catch (error) {
    console.error('Error al asignar encuestas al grupo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};