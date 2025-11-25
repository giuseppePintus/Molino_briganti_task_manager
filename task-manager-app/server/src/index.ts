import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import tasksRoutes from './routes/tasks';
import authRoutes from './routes/auth';
import backupRoutes from './routes/backup';
import settingsRoutes from './routes/settings';
import inventoryRoutes from './routes/inventory';
import codificheRoutes from './routes/codifiche';
import setupBackupMiddleware from './middleware/backupMiddleware';
import BackupService from './services/backupService';
import { initializeDatabaseIfEmpty } from './services/databaseInit';

const execAsync = promisify(exec);
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
app.use('/api/settings', settingsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/codifiche', codificheRoutes);

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
    // Sincronizza database schema usando prisma db push
    console.log('📦 Synchronizing database schema...');
    try {
      await execAsync('npx prisma db push --skip-generate --skip-preview', {
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env }
      });
      console.log('✅ Database schema synchronized');
    } catch (err: any) {
      console.error('❌ Database schema sync error:', err.message);
      // Se fallisce, continua comunque - potrebbero essere warnings non critici
    }

    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Inizializza database con utenti di default se vuoto
    await initializeDatabaseIfEmpty(prisma);

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

    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`🌐 Web UI: http://localhost:${PORT}`);
    console.log(`💾 Backup API: http://localhost:${PORT}/api/backup`);
  } catch (err) {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});