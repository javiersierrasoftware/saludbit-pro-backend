import { Router } from 'express';
import { getSubmissionsByDay } from '../controllers/reports.controller';

const router = Router();

// Ruta para obtener el número de envíos por día
router.get('/submissions-by-day', getSubmissionsByDay);

export default router;