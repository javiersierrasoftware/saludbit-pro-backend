import { Router } from 'express';
import {
  updateInstitution,
  getUsersByInstitution,
} from '../controllers/user.controller';

const router = Router();

// ✅ Actualizar institución de un usuario
// PUT /api/users/:id/institution
router.put('/:id/institution', updateInstitution);

// ✅ Obtener todos los usuarios de una institución
// GET /api/users/institution/:institutionId
router.get('/institution/:institutionId', getUsersByInstitution);

export default router;