import { Response } from 'express';
import prisma from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { AssignmentStatus } from '@prisma/client';

export const assignSurveyToInstitution = async (req: AuthRequest, res: Response) => {
  const { surveyId } = req.params;
  const adminId = req.userId;

  if (!adminId) {
    return res.status(401).json({ message: 'Usuario no autenticado.' });
  }

  try {
    // 1. Obtener la institución del administrador.
    const admin = await prisma.user.findUnique({ where: { id: adminId } });
    if (!admin) {
      return res.status(404).json({ message: 'Administrador no encontrado.' });
    }

    // 2. Obtener la encuesta para saber la fecha de cierre.
    const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) {
      return res.status(404).json({ message: 'Encuesta no encontrada.' });
    }

    // 3. Encontrar todos los estudiantes de esa institución.
    const students = await prisma.user.findMany({
      where: {
        institutionId: admin.institutionId,
        role: 'STUDENT',
      },
    });

    // 4. Obtener las asignaciones que ya existen para esta encuesta.
    const existingAssignments = await prisma.surveyAssignment.findMany({
      where: { surveyId: surveyId },
      select: { userId: true }, // Solo necesitamos los IDs de usuario
    });
    const assignedUserIds = new Set(existingAssignments.map((a) => a.userId));

    // 5. Filtrar los estudiantes que aún no tienen la encuesta asignada.
    const studentsToAssign = students.filter((student) => !assignedUserIds.has(student.id));

    if (studentsToAssign.length === 0) {
      return res.status(200).json({ message: 'Todos los estudiantes ya tienen esta encuesta asignada.' });
    }

    // 6. Crear una asignación para cada estudiante nuevo.
    const newAssignmentData = studentsToAssign.map((student) => ({
      userId: student.id,
      surveyId: surveyId,
      dueDate: survey.endDate,
      status: AssignmentStatus.PENDING,
    }));

    await prisma.surveyAssignment.createMany({
      data: newAssignmentData,
    });

    res.status(200).json({ message: `Encuesta asignada a ${studentsToAssign.length} nuevos estudiantes.` });
  } catch (error) {
    console.error('Error al asignar la encuesta:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};