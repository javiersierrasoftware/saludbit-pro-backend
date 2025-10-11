import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import institutionRoutes from './routes/institution.routes';
import userRoutes from './routes/user.routes';
import groupRoutes from './routes/group.routes'; // ✅ Nuevo
import processRoutes from './routes/process.routes'; // ✅ Nuevo
import recordRoutes from './routes/record.routes'; // ✅ Nuevo
import submissionRoutes from './routes/submission.routes'; // ✅ Nuevo
import dashboardRoutes from './routes/dashboard.routes'; // ✅ Nuevo

dotenv.config();
const app = express();

// Middleware para parsear JSON
app.use(express.json());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes); // ✅ Ruta para grupos
app.use('/api/processes', processRoutes); // ✅ Ruta para procesos
app.use('/api/records', recordRoutes); // ✅ Ruta para registros
app.use('/api/submissions', submissionRoutes); // ✅ Ruta para envíos
app.use('/api/dashboard', dashboardRoutes); // ✅ Ruta para el dashboard

// Puerto y conexión
const PORT = Number(process.env.PORT) || 3000;
mongoose
  .connect(process.env.MONGO_URI || '')
  .then(() => {
    console.log('Conectado a MongoDB');
    app.listen(PORT, '0.0.0.0', () => console.log(`Servidor en puerto ${PORT}`));
  })
  .catch((err) => console.error('Error al conectar DB', err));