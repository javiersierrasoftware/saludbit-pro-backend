import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getStats, getSubmissionsByRecord, getWeeklyProgress, getMonthlyProgress, getStudentRecordSummary, getAssignmentSummary, getInstitutionSummary } from '../controllers/dashboard.controller';

const router = Router();

router.use(authMiddleware);
router.get('/stats', getStats);
router.get('/submissions-by-record', getSubmissionsByRecord);
router.get('/weekly-progress', getWeeklyProgress);
router.get('/monthly-progress', getMonthlyProgress);
router.get('/student-record-summary', getStudentRecordSummary);
router.get('/assignment-summary', getAssignmentSummary);
router.get('/institution-summary', getInstitutionSummary);

export default router;