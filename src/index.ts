import express from 'express';
import dotenv from 'dotenv';
import surveyRoutes from './routes/survey.routes';
import authRoutes from './routes/auth.routes';
import groupRoutes from './routes/group.routes';
import institutionRoutes from './routes/institution.routes';
import userRoutes from './routes/user.routes';
import dashboardRoutes from './routes/dashboard.routes';
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

// Rutas protegidas para la gestión de instituciones (solo para super-admin)
app.use('/api/institutions', verifyToken, institutionRoutes);

// Rutas protegidas para la gestión de usuarios (solo para super-admin)
app.use('/api/users', verifyToken, userRoutes);

// Rutas protegidas para el dashboard
app.use('/api/dashboard', verifyToken, dashboardRoutes);

app.get('/', (req, res) => {
  res.send('API de SaludBit Pro está funcionando!');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});