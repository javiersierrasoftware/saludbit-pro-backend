import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createGroup, getGroups, updateGroup, deleteGroup, joinGroup, leaveGroup } from '../controllers/group.controller';

const router = Router();

// Todas las rutas de grupos requieren autenticación
router.use(authMiddleware);

// Definimos las rutas CRUD y de unión para los grupos
router.get('/', getGroups);
router.post('/', createGroup);
router.post('/join', joinGroup);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);
router.post('/leave/:id', leaveGroup);

export default router;