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
    const user = await User.findById(userId).select('role');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    let stats = {};

    if (user.role === 'ADMIN') {
      const groupsCount = await Group.countDocuments({ createdBy: userId });
      const processesCount = await Process.countDocuments({ createdBy: userId });
      const recordsCount = await Record.countDocuments({ createdBy: userId });
      stats = { groups: groupsCount, processes: processesCount, records: recordsCount };
    } else {
      // Student stats
      const groupsCount = await Group.countDocuments({ members: userId });
      const studentGroups = await Group.find({ members: userId }).select('processes');
      const processIds = [...new Set(studentGroups.flatMap(g => g.processes))];
      const processesWithRecords = await Process.find({ _id: { $in: processIds } }).select('records');
      const recordIds = [...new Set(processesWithRecords.flatMap(p => p.records))].filter(id => id);
      const recordsCount = await Record.countDocuments({ _id: { $in: recordIds } });
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