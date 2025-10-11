import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getStats, getSubmissionsByRecord } from '../controllers/dashboard.controller';

const router = Router();

router.use(authMiddleware);
router.get('/stats', getStats);
router.get('/submissions-by-record', getSubmissionsByRecord);

export default router;