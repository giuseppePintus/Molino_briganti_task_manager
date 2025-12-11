import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Load version from package.json
const packageJson = require('../../package.json');
const APP_VERSION = packageJson.version || '1.0.0';

import express from 'express';
import cors from 'cors';
import http from 'http';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import tasksRoutes from './routes/tasks';
import authRoutes from './routes/auth';
import backupRoutes from './routes/backup';
import settingsRoutes from './routes/settings';
import inventoryRoutes from './routes/inventory';
import codificheRoutes from './routes/codifiche';
import uploadRoutes, { UPLOAD_DIR } from './routes/upload';
import ordersRoutes from './routes/orders';
import tripsRoutes from './routes/trips';
import customersRoutes from './routes/customers';
import setupBackupMiddleware from './middleware/backupMiddleware';
import BackupService from './services/backupService';
import { initializeDatabaseIfEmpty } from './services/databaseInit';
import { socketService } from './services/socketService';

const execAsync = promisify(exec);
const app = express();
const httpServer = http.createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Inizializza WebSocket
socketService.initialize(httpServer);

// Crea cartella uploads se non esiste
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Cartella uploads creata');
}

// Middleware
app.use(cors());
app.use(express.json());

// Disable caching for all static files
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '../../public')));

// Serve uploads da directory persistente (bind mount in produzione)
app.use('/uploads', express.static(UPLOAD_DIR));
console.log(`📂 Uploads directory: ${UPLOAD_DIR}`);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/codifiche', codificheRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/customers', customersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: APP_VERSION });
});

// Version endpoint
app.get('/api/version', (req, res) => {
  res.json({ version: APP_VERSION, date: new Date().toISOString().split('T')[0] });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Start server with WebSocket support
httpServer.listen(PORT, async () => {
  try {
    // Sincronizza database schema usando prisma db push (DISABLED for testing)
    // console.log('📦 Synchronizing database schema...');
    // try {
    //   const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
    //   await execAsync(`npx prisma db push --skip-generate --schema="${schemaPath}"`, {
    //     cwd: path.join(__dirname, '../..'),
    //     env: { ...process.env }
    //   });
    //   console.log('✅ Database schema synchronized');
    // } catch (err: any) {
    //   console.error('❌ Database schema sync error:', err.message);
    //   // Se fallisce, continua comunque - potrebbero essere warnings non critici
    // }

    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Inizializza database con utenti di default se vuoto
    await initializeDatabaseIfEmpty(prisma);

    // Setup backup middleware DOPO connessione
    setupBackupMiddleware(prisma);

    // Ripristina ultimo backup dal NAS se disponibile (DISABLED for testing)
    // try {
    //   console.log('🔄 Checking for backups on NAS...');
    //   await BackupService.restoreLatestFromNas();
    // } catch (err) {
    //   console.log('ℹ️ No backups available on NAS (first run)');
    // }

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
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
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