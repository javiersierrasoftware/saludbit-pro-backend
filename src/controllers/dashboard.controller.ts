import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/user.model';
import { Group } from '../models/group.model';
import { Process } from '../models/process.model';
import { Record } from '../models/record.model';
import { Submission } from '../models/submission.model';

export const getStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const user = await User.findById(userId).select('role institution deactivatedGroupIds');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    let stats = {};

    if (user.role === 'ADMIN') {
      let studentsCount = 0;
      let groupsCount = 0;
      let processesCount = 0;
      let recordsCount = 0;
      if (user.institution) {
        studentsCount = await User.countDocuments({ institution: user.institution, role: 'STUDENT' });
        groupsCount = await Group.countDocuments({ institution: user.institution });
        processesCount = await Process.countDocuments({ institution: user.institution });
        recordsCount = await Record.countDocuments({ institution: user.institution });
      }
      stats = { students: studentsCount, groups: groupsCount, processes: processesCount, records: recordsCount };
    } else {
      // Student stats
      const deactivatedGroupIds = user.deactivatedGroupIds || [];
      const activeGroupsQuery = { members: userId, _id: { $nin: deactivatedGroupIds } };

      const groupsCount = await Group.countDocuments({ members: userId }); // Total de grupos a los que pertenece
      const studentGroups = await Group.find(activeGroupsQuery).select('processes');
      const processIds = [...new Set(studentGroups.flatMap(g => g.processes))];
      const processesWithRecords = await Process.find({ _id: { $in: processIds } }).select('records');
      const recordIds = [...new Set(processesWithRecords.flatMap(p => p.records))].filter(id => id);
      const recordsCount = recordIds.length; // Contamos las asignaciones únicas de registros activos
      const submissionsCount = await Submission.countDocuments({ student: userId });
      stats = { groups: groupsCount, records: recordsCount, submissions: submissionsCount };
    }

    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return res.status(500).json({ message: 'Error del servidor.' });
  }
};

const getFilterDates = (filter?: string) => {
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  switch (filter) {
    case 'day':
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case 'week':
      const firstDayOfWeek = now.getDate() - now.getDay();
      startDate = new Date(now.setDate(firstDayOfWeek));
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'semester1':
      startDate = new Date(now.getFullYear(), 0, 1); // Jan 1
      endDate = new Date(now.getFullYear(), 5, 30, 23, 59, 59, 999); // June 30
      break;
    case 'semester2':
      startDate = new Date(now.getFullYear(), 6, 1); // July 1
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); // Dec 31
      break;
  }
  return { startDate, endDate };
};

export const getSubmissionsByRecord = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { filter } = req.query;
    const admin = await User.findById(userId).select('institution');

    console.log(`[Dashboard] Admin ID: ${admin?._id}, Institución: ${admin?.institution || 'Ninguna (Global)'}`);

    const matchQuery: { student?: { $in: mongoose.Types.ObjectId[] } } = {};

    // 1. Si el admin tiene una institución, filtramos por los estudiantes de esa institución
    if (admin && admin.institution) {
      const students = await User.find({ institution: admin.institution, role: 'STUDENT' }).select('_id');
      const studentIds = students.map(s => s._id as mongoose.Types.ObjectId);
      console.log(`[Dashboard] Estudiantes encontrados en la institución: ${studentIds.length}`);
      // Si no hay estudiantes en la institución, la gráfica estará vacía, lo cual es correcto.
      if (studentIds.length === 0) {
        console.log('[Dashboard] No hay estudiantes, devolviendo array vacío.');
        return res.status(200).json([]);
      }
      matchQuery.student = { $in: studentIds };
    } else {
      console.log('[Dashboard] Admin global, buscando en todos los envíos.');
    }

    const { startDate, endDate } = getFilterDates(filter as string | undefined);
    let dateMatch = {};
    if (startDate && endDate) {
      dateMatch = { createdAt: { $gte: startDate, $lte: endDate } };
    } else if (startDate) {
      dateMatch = { createdAt: { $gte: startDate } };
    }

    // Construir el filtro final correctamente
    const conditions = [];
    if (Object.keys(matchQuery).length > 0) conditions.push(matchQuery);
    if (Object.keys(dateMatch).length > 0) conditions.push(dateMatch);

    const finalMatch = conditions.length > 0 ? { $and: conditions } : {};

    console.log('[Dashboard] Filtro final para la consulta:', JSON.stringify(finalMatch, null, 2));

    const submissionsData = await Submission.aggregate([
      // 2. Filtrar envíos por estudiantes y/o fecha
      { $match: finalMatch },
      { $group: { _id: '$record', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }, // Limitar a los 10 registros más populares
      {
        $lookup: {
          from: 'records', // el nombre de la colección en MongoDB
          localField: '_id',
          foreignField: '_id',
          as: 'recordDetails',
        },
      },
      { $unwind: '$recordDetails' },
      {
        $project: {
          _id: 0,
          recordName: '$recordDetails.name',
          count: '$count',
        },
      },
    ]);

    console.log('Datos de la gráfica enviados:', submissionsData);

    return res.status(200).json(submissionsData);
  } catch (error) {
    console.error('Error al obtener datos para la gráfica:', error);
    return res.status(500).json({ message: 'Error del servidor.' });
  }
};

// Helper para obtener el número de la semana de una fecha
const getWeekNumber = (d: Date): [number, number] => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Mover al jueves de esa semana
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  // Inicio del año
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calcular el número de la semana
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return [d.getUTCFullYear(), weekNo];
};

export const getWeeklyProgress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;

    // Obtener todos los envíos del estudiante
    const submissions = await Submission.find({ student: userId }).select('createdAt').sort({ createdAt: 'asc' });

    if (submissions.length === 0) {
      return res.status(200).json([]);
    }

    // Agrupar envíos por semana
    const weeklyActivity: { [key: string]: Set<number> } = {}; // key: "YYYY-WW", value: Set de días [0-6]

    submissions.forEach(submission => {
      const date = new Date(submission.createdAt);
      const [year, week] = getWeekNumber(date);
      const dayOfWeek = (date.getUTCDay() + 6) % 7; // Lunes = 0, Domingo = 6
      const weekKey = `${year}-${week}`;

      if (!weeklyActivity[weekKey]) {
        weeklyActivity[weekKey] = new Set();
      }
      weeklyActivity[weekKey].add(dayOfWeek);
    });

    // Formatear los datos para el frontend
    const formattedData = Object.keys(weeklyActivity).map(weekKey => {
      const [year, weekNumber] = weekKey.split('-').map(Number);
      const daysArray = Array(7).fill(false);
      weeklyActivity[weekKey].forEach(dayIndex => { daysArray[dayIndex] = true; });
      return { weekNumber, year, days: daysArray };
    }).sort((a, b) => b.year - a.year || b.weekNumber - a.weekNumber); // Ordenar de más reciente a más antiguo

    return res.status(200).json(formattedData);
  } catch (error) {
    console.error('Error al obtener progreso semanal:', error);
    return res.status(500).json({ message: 'Error del servidor.' });
  }
};

export const getMonthlyProgress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { month, year } = req.query; // Mes (1-12), Año
    const user = await User.findById(userId).select('role institution');

    if (!month || !year) {
      return res.status(400).json({ message: 'Mes y año son requeridos.' });
    }

    // Construir el filtro de estudiantes
    let studentMatch: any = { student: userId };
    if (user?.role === 'ADMIN' && user.institution) {
      const students = await User.find({ institution: user.institution, role: 'STUDENT' }).select('_id');
      const studentIds = students.map(s => s._id);
      studentMatch = { student: { $in: studentIds } };
    }

    const startDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    const endDate = new Date(Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999));

    const submissions = await Submission.find({
      ...studentMatch,
      createdAt: { $gte: startDate, $lte: endDate },
    }).select('createdAt');

    // Crear un mapa de actividad por día
    const activityByDay: { [day: number]: number } = {};
    submissions.forEach(sub => {
      const dayOfMonth = sub.createdAt.getUTCDate();
      activityByDay[dayOfMonth] = (activityByDay[dayOfMonth] || 0) + 1;
    });

    // Generar la estructura del calendario
    const calendar: { day: number; hasActivity: boolean }[][] = [];
    const daysInMonth = endDate.getUTCDate();
    const firstDayOfWeek = (new Date(Date.UTC(Number(year), Number(month) - 1, 1)).getUTCDay() + 6) % 7; // Lunes=0

    let currentDay = 1;
    for (let w = 0; currentDay <= daysInMonth; w++) {
      const week: { day: number; hasActivity: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        if ((w === 0 && d < firstDayOfWeek) || currentDay > daysInMonth) {
          week.push({ day: 0, hasActivity: false }); // Día vacío
        } else {
          week.push({ day: currentDay, hasActivity: !!activityByDay[currentDay] });
          currentDay++;
        }
      }
      calendar.push(week);
    }

    // Calcular totales por semana
    const weeklyTotals = calendar.map(week =>
      week.reduce((total, day) => total + (activityByDay[day.day] || 0), 0)
    );

    return res.status(200).json({
      calendar,
      weeklyTotals,
    });
  } catch (error) {
    console.error('Error al obtener progreso mensual:', error);
    return res.status(500).json({ message: 'Error del servidor.' });
  }
};

export const getStudentRecordSummary = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;

    const summary = await Submission.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$record', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }, // Top 5 registros más diligenciados
      {
        $lookup: {
          from: 'records',
          localField: '_id',
          foreignField: '_id',
          as: 'recordDetails',
        },
      },
      { $unwind: '$recordDetails' },
      {
        $project: {
          _id: 0,
          name: '$recordDetails.name',
          count: '$count',
        },
      },
    ]);

    return res.status(200).json(summary);
  } catch (error) {
    console.error('Error al obtener resumen de registros del estudiante:', error);
    return res.status(500).json({ message: 'Error del servidor.' });
  }
};

export const getAssignmentSummary = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { filter } = req.query as { filter?: string }; // Aseguramos el tipo
    const user = await User.findById(userId).select('role institution deactivatedGroupIds');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // 1. Definir el ámbito de la consulta (estudiante o institución) y los grupos relevantes
    let groupQuery: any = {};
    let submissionStudentMatch: any = { student: new mongoose.Types.ObjectId(userId) };

    if (user.role === 'ADMIN' && user.institution) {
      groupQuery = { institution: user.institution };
      const studentsInInstitution = await User.find({ institution: user.institution, role: 'STUDENT' }).select('_id');
      submissionStudentMatch = { student: { $in: studentsInInstitution.map(s => s._id) } };
    } else if (user.role === 'STUDENT') {
      const deactivatedGroupIds = user.deactivatedGroupIds || [];
      groupQuery = { members: userId, _id: { $nin: deactivatedGroupIds } };
    }

    // 2. Obtener todas las asignaciones relevantes para saber qué barras mostrar
    const relevantGroups = await Group.find(groupQuery).populate({ path: 'processes', populate: { path: 'records', select: 'name' } });
    const allAssignments = relevantGroups.flatMap((group: any) =>
      group.processes.flatMap((process: any) =>
        process.records.map((record: any) => ({
          recordId: record._id,
          groupId: group._id,
          processId: process._id,
          name: `${record.name} (${group.name})`,
        }))
      )
    );

    // 3. Construir el filtro de fecha
    const { startDate, endDate } = getFilterDates(filter);
    const dateMatch: any = {};
    if (startDate) dateMatch.$gte = startDate;
    if (endDate) dateMatch.$lte = endDate;

    // 4. Contar los envíos para cada asignación con el filtro de fecha
    const summary = await Promise.all(
      allAssignments.map(async (assignment) => {
        const matchQuery: any = {
          ...submissionStudentMatch,
          record: assignment.recordId,
          group: assignment.groupId,
          process: assignment.processId,
        };
        if (Object.keys(dateMatch).length > 0) {
          matchQuery.createdAt = dateMatch;
        }
        const count = await Submission.countDocuments(matchQuery);
        return { name: assignment.name, count };
      })
    );

    return res.status(200).json(summary);
  } catch (error) {
    console.error('Error al obtener resumen de asignaciones:', error);
    return res.status(500).json({ message: 'Error del servidor.' });
  }
};

export const getInstitutionSummary = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const admin = await User.findById(userId).select('institution');

    if (!admin || !admin.institution) {
      return res.status(400).json({ message: 'Admin no asignado a una institución.' });
    }
    const institutionId = admin.institution;

    // 1. Obtener la estructura anidada de Grupos -> Procesos -> Registros
    const groups = await Group.find({ institution: institutionId })
      .populate({
        path: 'processes',
        populate: {
          path: 'records',
          model: 'Record',
        },
      })
      .lean(); // .lean() para obtener objetos JS planos, más rápido

    // 2. Analizar las respuestas para cada pregunta
    const summary = await Promise.all(
      groups.map(async (group) => {
        const processes = await Promise.all(
          (group.processes as any[]).map(async (process) => {
            const records = await Promise.all(
              (process.records as any[]).map(async (record) => {
                const questions = await Promise.all(
                  (record.questions as any[]).map(async (question, index) => {
                    let analysis;
                    if (question.type === 'single' || question.type === 'multiple') {
                      // Contar opciones
                      analysis = await Submission.aggregate([
                        { $match: { record: record._id } },
                        { $unwind: '$answers' },
                        { $match: { 'answers.questionIndex': index } },
                        { $unwind: '$answers.answer' },
                        { $group: { _id: '$answers.answer', count: { $sum: 1 } } },
                        { $project: { name: '$_id', count: 1, _id: 0 } },
                        { $sort: { count: -1 } },
                      ]);
                    } else {
                      // Obtener últimas 5 respuestas de texto
                      const textAnswers = await Submission.aggregate([
                        { $match: { record: record._id } },
                        { $unwind: '$answers' },
                        { $match: { 'answers.questionIndex': index } },
                        { $sort: { createdAt: -1 } },
                        { $limit: 5 },
                        { $project: { answer: '$answers.answer', _id: 0 } },
                      ]);
                      analysis = textAnswers.map(a => a.answer);
                    }
                    return { ...question, analysis: analysis || [] };
                  })
                );
                return { ...record, questions };
              })
            );
            return { ...process, records };
          })
        );
        return { ...group, processes };
      })
    );

    return res.status(200).json(summary);
  } catch (error) {
    console.error('Error al obtener resumen de la institución:', error);
    return res.status(500).json({ message: 'Error del servidor.' });
  }
};