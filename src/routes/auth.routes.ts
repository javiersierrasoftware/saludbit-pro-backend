import { Router } from 'express';
import { login, register } from '../controllers/auth.controller';

const router = Router();

// Ruta para iniciar sesión
// POST /api/auth/login
router.post('/login', login);

// Ruta para registrar un nuevo usuario
// POST /api/auth/register
router.post('/register', register);

export default router;