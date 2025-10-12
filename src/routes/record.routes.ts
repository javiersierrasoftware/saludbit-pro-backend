import { Router } from 'express';
import {
  getStudentAssignments,
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
} from '../controllers/record.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', createRecord);
router.get('/', getRecords);
router.get('/assignments', getStudentAssignments);
router.get('/:id', getRecordById);
router.put('/:id', updateRecord);
router.delete('/:id', deleteRecord);

export default router;