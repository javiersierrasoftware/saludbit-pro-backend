import express from 'express';
import dotenv from 'dotenv';
import surveyRoutes from './routes/survey.routes';
import authRoutes from './routes/auth.routes';
import groupRoutes from './routes/group.routes';
import { verifyToken } from './middleware/auth.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Rutas públicas (login y registro)
app.use('/api/auth', authRoutes);

// Rutas protegidas para usuarios (ver encuestas, responder, etc.)
app.use('/api/surveys', verifyToken, surveyRoutes);

// Rutas protegidas para la gestión de grupos
app.use('/api/groups', verifyToken, groupRoutes);

app.get('/', (req, res) => {
  res.send('API de SaludBit Pro está funcionando!');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});