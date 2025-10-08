import { Router } from 'express';
import { forgotPassword, login, register, resetPassword } from '../controllers/auth.controller';

const router = Router();

// Ruta para iniciar sesión
// POST /api/auth/login
router.post('/login', login);

// Ruta para registrar un nuevo usuario
// POST /api/auth/register
router.post('/register', register);

// Ruta para solicitar recuperación de contraseña
router.post('/forgot-password', forgotPassword);

// Ruta para resetear la contraseña con el token
router.post('/reset-password', resetPassword);

export default router;