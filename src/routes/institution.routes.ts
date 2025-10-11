import { Router } from 'express';
import {
  createInstitution,
  getInstitutions,
  updateInstitution,
} from '../controllers/institution.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Todas las rutas de instituciones requieren autenticación
router.use(authMiddleware);

router.post('/', createInstitution);
router.get('/', getInstitutions);
router.put('/:id', updateInstitution);

export default router;