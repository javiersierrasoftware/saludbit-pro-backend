import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import surveyRoutes from './routes/survey.routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Usar las rutas de autenticación
app.use('/api/auth', authRoutes);

// Usar las rutas de encuestas
app.use('/api/surveys', surveyRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('¡El backend de ImpactoU está funcionando!');
});


app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});