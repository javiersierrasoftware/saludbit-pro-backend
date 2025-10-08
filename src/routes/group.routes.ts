import { Router } from 'express';
import { assignSurveysToGroup, createGroup, deleteGroup, getGroups, joinGroup, removeMemberFromGroup } from '../controllers/group.controller';

const router = Router();

// Ruta para crear un nuevo grupo - La hacemos más específica
router.post('/create', createGroup);

// Ruta para asignar encuestas a un grupo
router.post('/:groupId/assign-surveys', assignSurveysToGroup);

// Ruta para eliminar un grupo
router.delete('/:groupId', deleteGroup);

// Ruta para eliminar un miembro de un grupo
router.delete('/:groupId/members/:memberId', removeMemberFromGroup);

// Ruta para que un usuario se una a un grupo
router.post('/join', joinGroup);

// Ruta para obtener los grupos del usuario - La movemos al final para evitar conflictos
router.get('/', getGroups);

export default router;