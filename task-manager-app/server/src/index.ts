import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import tasksRoutes from './routes/tasks';
import authRoutes from './routes/auth';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Start server
app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
    console.log(`Server is running on port ${PORT}`);
    console.log(`Web UI: http://localhost:${PORT}`);
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});