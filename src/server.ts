import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import tournamentRoutes from './routes/tournament.routes';
import playerRoutes from './routes/player.routes';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log('Request body:', req.body);
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'WeiqiBiSai API is running',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      tournaments: '/api/tournaments',
      players: '/api/players',
      auth: '/api/auth'
    }
  });
});

// Routes
app.use('/api/tournaments', tournamentRoutes);
//app.use('/api/players', playerRoutes);   //comment out 2024.12.21
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/weiqibisai';
mongoose.connect(mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
