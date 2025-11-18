import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import tasksRoutes from './routes/tasks';
import authRoutes from './routes/auth';
import backupRoutes from './routes/backup';
import setupBackupMiddleware from './middleware/backupMiddleware';
import BackupService from './services/backupService';

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
app.use('/api/backup', backupRoutes);

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

    // Setup backup middleware DOPO connessione
    setupBackupMiddleware(prisma);

    // Ripristina ultimo backup dal NAS se disponibile
    try {
      console.log('🔄 Checking for backups on NAS...');
      await BackupService.restoreLatestFromNas();
    } catch (err) {
      console.log('ℹ️ No backups available on NAS (first run)');
    }

    // Attiva backup automatico ogni ora
    BackupService.setupAutoBackup(60);

    // Backup iniziale
    try {
      await BackupService.backupDatabase();
    } catch (err) {
      console.warn('⚠️ Initial backup failed:', err);
    }

    console.log(`Server is running on port ${PORT}`);
    console.log(`Web UI: http://localhost:${PORT}`);
    console.log(`Backup API: http://localhost:${PORT}/api/backup`);
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