import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createProcess, getProcesses, updateProcess, deleteProcess } from '../controllers/process.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', createProcess);
router.get('/', getProcesses);
router.put('/:id', updateProcess);
router.delete('/:id', deleteProcess);

export default router;