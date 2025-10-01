import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';

const router = Router();

// Ruta para obtener las estadísticas del dashboard del usuario
router.get('/stats', getDashboardStats);

export default router;