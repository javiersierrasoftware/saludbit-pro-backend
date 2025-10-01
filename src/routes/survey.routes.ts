import { Router } from 'express';
import { addQuestionToSurvey, createSurvey, deleteSurvey, exportSurveyResults, getAssignedSurveys, getAllSurveys, getQuestionById, getQuestionsForSurvey, getSurveyById, getSurveyResults, updateQuestion, updateSurvey } from '../controllers/survey.controller';
import { submitAnswers } from '../controllers/answer.controller';
import { assignSurveyToGroup, assignSurveyToInstitution } from '../controllers/assignment.controller';

const router = Router();

// Crear una nueva encuesta (solo para administradores) - Ruta específica para evitar conflictos
router.post('/create', createSurvey);

// Obtener encuestas asignadas (para cualquier usuario logueado) - Esta debe ir después de las rutas específicas
router.get('/', getAssignedSurveys);

// Obtener TODAS las encuestas (para selectores de admin) - Debe ir antes de las rutas con :surveyId
router.get('/all', getAllSurveys);

// Obtener los resultados de una encuesta (solo para administradores)
router.get('/:surveyId/results', getSurveyResults);

// Exportar los resultados de una encuesta a CSV (solo para administradores)
router.get('/:surveyId/export', exportSurveyResults);

// Añadir una pregunta a una encuesta existente (solo para administradores)
router.post('/:surveyId/questions', addQuestionToSurvey);

// Obtener las preguntas de una encuesta específica (para cualquier usuario logueado)
router.get('/:surveyId/questions', getQuestionsForSurvey);

// Obtener una pregunta específica por ID (solo para administradores)
router.get('/:surveyId/questions/:questionId', getQuestionById);

// Actualizar una pregunta específica (solo para administradores)
router.patch('/:surveyId/questions/:questionId', updateQuestion);

// Enviar las respuestas de una encuesta
router.post('/:surveyId/answers', submitAnswers);

// Asignar una encuesta a todos los estudiantes de la institución (solo para administradores)
router.post('/:surveyId/assign', assignSurveyToInstitution);

// Asignar una encuesta a un grupo específico
router.post('/:surveyId/assign-to-group', assignSurveyToGroup);

// Actualizar una encuesta (solo para administradores)
router.patch('/:surveyId', updateSurvey);

// Eliminar una encuesta (solo para administradores)
router.delete('/:surveyId', deleteSurvey);

// Obtener un registro específico por ID - Esta es la ruta más genérica, por lo que va al final.
router.get('/:surveyId', getSurveyById);

export default router;