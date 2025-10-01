import { Router } from 'express';
import { assignAdminsToInstitution, createInstitution, getInstitutions } from '../controllers/institution.controller';

const router = Router();

// Ruta para crear una nueva institución (solo para admins)
router.post('/', createInstitution);

// Ruta para asignar administradores a una institución
router.patch('/:institutionId/assign-admins', assignAdminsToInstitution);

// Ruta para obtener todas las instituciones
router.get('/', getInstitutions);

export default router;