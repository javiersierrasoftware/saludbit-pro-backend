import { Router } from 'express';
import { getSubmissionHistory, getUsers } from '../controllers/user.controller';

const router = Router();

// Ruta para obtener todos los usuarios (para selectores de admin)
router.get('/', getUsers);

// Ruta para obtener el historial de envíos de un estudiante
router.get('/submission-history', getSubmissionHistory);

export default router;