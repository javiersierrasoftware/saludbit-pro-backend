import express from 'express';
import { register, login, changePassword } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

// Rutas públicas
router.post('/register', register);
router.post('/login', login);

// Rutas protegidas (requieren token)
router.put('/change-password', authMiddleware, changePassword);

export default router;