import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createRecord, getRecords, updateRecord, deleteRecord, getRecordById } from '../controllers/record.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getRecords);
router.get('/:id', getRecordById);
router.post('/', createRecord);
router.put('/:id', updateRecord);
router.delete('/:id', deleteRecord);

export default router;