import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createSubmission, getSubmissionHistory } from '../controllers/submission.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', createSubmission);
router.get('/history', getSubmissionHistory);

export default router;