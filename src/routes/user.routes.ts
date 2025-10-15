import { Router } from 'express';
import { updateUserRole, getUsersByInstitution } from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Aplicamos el middleware de autenticación a todas las rutas de usuario
router.use(authMiddleware);

router.put('/:id/role', updateUserRole);

export default router;