import { Router } from 'express';
import { getUsers } from '../controllers/user.controller';

const router = Router();

// Ruta para obtener todos los usuarios (para selectores de admin)
router.get('/', getUsers);

export default router;