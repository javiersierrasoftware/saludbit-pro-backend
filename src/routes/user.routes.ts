import { Router } from 'express';
import { updateUserRole, deleteUserAccount } from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Aplicamos el middleware de autenticación a todas las rutas de usuario
router.use(authMiddleware);

router.put('/:id/role', updateUserRole);
router.delete('/:id', deleteUserAccount);

export default router;