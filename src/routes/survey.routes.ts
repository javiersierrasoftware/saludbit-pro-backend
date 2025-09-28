import { Router } from 'express';
import { addQuestionToSurvey, createSurvey, deleteSurvey, exportSurveyResults, getAssignedSurveys, getQuestionById, getQuestionsForSurvey, getSurveyResults, updateQuestion, updateSurvey } from '../controllers/survey.controller';
import { submitAnswers } from '../controllers/answer.controller';
import { assignSurveyToInstitution } from '../controllers/assignment.controller';
import { AuthRequest, verifyToken } from '../middleware/auth.middleware';
import { verifyAdmin } from '../middleware/admin.middleware';

const router = Router();

// Obtener encuestas asignadas (para cualquier usuario logueado)
router.get('/', verifyToken, getAssignedSurveys);

// Crear una nueva encuesta (solo para administradores)
router.post('/', verifyToken, verifyAdmin, (req, res) => createSurvey(req as AuthRequest, res));

// Obtener las preguntas de una encuesta específica (para cualquier usuario logueado)
router.get('/:surveyId/questions', verifyToken, getQuestionsForSurvey);

// Obtener los resultados de una encuesta (solo para administradores)
router.get('/:surveyId/results', verifyToken, verifyAdmin, getSurveyResults);

// Exportar los resultados de una encuesta a CSV (solo para administradores)
router.get('/:surveyId/export', verifyToken, verifyAdmin, exportSurveyResults);

// Añadir una pregunta a una encuesta existente (solo para administradores)
router.post('/:surveyId/questions', verifyToken, verifyAdmin, addQuestionToSurvey);

// Obtener una pregunta específica por ID (solo para administradores)
router.get('/:surveyId/questions/:questionId', verifyToken, verifyAdmin, getQuestionById);

// Actualizar una pregunta específica (solo para administradores)
router.patch('/:surveyId/questions/:questionId', verifyToken, verifyAdmin, updateQuestion);

// Enviar las respuestas de una encuesta
router.post('/:surveyId/answers', verifyToken, submitAnswers);

// Asignar una encuesta a todos los estudiantes de la institución (solo para administradores)
router.post('/:surveyId/assign', verifyToken, verifyAdmin, assignSurveyToInstitution);

// Actualizar una encuesta (solo para administradores)
router.patch('/:surveyId', verifyToken, verifyAdmin, updateSurvey);

// Eliminar una encuesta (solo para administradores)
router.delete('/:surveyId', verifyToken, verifyAdmin, deleteSurvey);

export default router;