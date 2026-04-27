import * as dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Load version from package.json
let APP_VERSION = '1.0.0';
try {
  // In production (dist/index.js), package.json is one level up
  // In development (src/index.ts), package.json is two levels up
  const paths = [
    path.join(__dirname, '../package.json'),
    path.join(__dirname, '../../package.json')
  ];
  
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
      APP_VERSION = pkg.version || '1.0.0';
      break;
    }
  }
} catch (e) {
  console.warn('⚠️ Errore caricamento versione:', e);
}

// Check if compiled files have been updated since last boot
// This allows live reload when dist files are updated
const bootMarkerFile = path.join(__dirname, '.boot-marker');
const inventoryServiceFile = path.join(__dirname, './services/inventoryService.js');

if (fs.existsSync(inventoryServiceFile)) {
  const inventoryMtime = fs.statSync(inventoryServiceFile).mtime.getTime();
  const currentTime = Date.now();
  const timeDiff = (currentTime - inventoryMtime) / 1000; // in seconds
  
  if (fs.existsSync(bootMarkerFile)) {
    const bootMarkerMtime = fs.statSync(bootMarkerFile).mtime.getTime();
    const timeSinceBoot = (currentTime - bootMarkerMtime) / 1000;
    
    if (inventoryMtime > bootMarkerMtime) {
      console.log(`🔄 RILEVATO: Codice compilato aggiornato (${Math.round(timeSinceBoot)}s fa)`);
      console.log(`   File: inventoryService.js è stato rigenerato`);
      console.log(`   ⚠️  Cache Node.js potrebbe essere stantio - esecuzione con nuovo codice`);
    }
  }
}

// Update boot marker
try {
  fs.writeFileSync(bootMarkerFile, Date.now().toString(), 'utf-8');
} catch (e) {
  console.warn('⚠️ Non riesco a scrivere boot marker:', e);
}

import express from 'express';
import cors from 'cors';
import http from 'http';

import { exec } from 'child_process';
import { promisify } from 'util';
import tasksRoutes from './routes/tasks';
import authRoutes from './routes/auth';
import backupRoutes from './routes/backup';
import settingsRoutes from './routes/settings';
import inventoryRoutes from './routes/inventory';
import categoriesRoutes from './routes/categories';
import alertsRoutes from './routes/alerts';
import codificheRoutes from './routes/codifiche';
import uploadRoutes, { UPLOAD_DIR } from './routes/upload';
import ordersRoutes from './routes/orders';
import tripsRoutes from './routes/trips';
import customersRoutes from './routes/customers';
import debugRoutes from './routes/debug';
import setupBackupMiddleware from './middleware/backupMiddleware';
import BackupService from './services/backupService';
import prisma from './lib/prisma';
import { initializeDatabaseIfEmpty } from './services/databaseInit';
import { socketService } from './services/socketService';
// WarehouseService imported lazily in endpoints to avoid sqlite3 dependency issue

const execAsync = promisify(exec);
const app = express();
const httpServer = http.createServer(app);
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
const publicPath = path.join(process.cwd(), 'public');
console.log(`📁 Public directory: ${publicPath}`);
app.use(express.static(publicPath));

// Serve uploads da directory persistente (bind mount in produzione)
app.use('/uploads', express.static(UPLOAD_DIR));
console.log(`📂 Uploads directory: ${UPLOAD_DIR}`);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/codifiche', codificheRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/debug', debugRoutes);

// Inline endpoint - List all HTML pages in public dir (for Indice feature)
app.get('/api/pages', (req, res) => {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const files = fs.readdirSync(publicDir).filter((f: string) => f.endsWith('.html'));
    const pages = files.map((f: string) => {
      let title = f.replace('.html', '').replace(/-/g, ' ');
      try {
        const content = fs.readFileSync(path.join(publicDir, f), 'utf8');
        const match = content.match(/<title>([^<]+)<\/title>/i);
        if (match) title = match[1].replace(/ - Molino Briganti/i, '').trim();
      } catch {}
      return { file: f, title };
    });
    res.json(pages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Inline endpoint - Import warehouse from PDF
app.post('/api/warehouse/import-from-pdf', async (req, res) => {
  try {
    console.log('📄 [INLINE] Warehouse PDF import requested');
    const result = await (require('./services/warehouseService').WarehouseService).importFromPdf();
    res.json({
      success: true,
      message: 'Warehouse imported successfully',
      data: result
    });
  } catch (error: any) {
    console.error('❌ [INLINE] Warehouse import error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Inline endpoint - Get warehouse articles
app.get('/api/warehouse/articles', async (req, res) => {
  try {
    const articles = await (require('./services/warehouseService').WarehouseService).getAllArticles();
    res.json({
      success: true,
      data: articles
    });
  } catch (error: any) {
    console.error('❌ [INLINE] Get warehouse articles error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Force reload of modules (emergency restart without killing process)
app.post('/api/admin/reload-modules', (req, res) => {
  try {
    console.log('🔄 Ricaricamento forzato moduli...');
    
    // Pulisci la cache dei moduli per i servizi principali
    const modulesToReload = [
      require.cache[require.resolve('./services/inventoryService.js')],
      require.cache[require.resolve('./routes/inventory.js')],
      require.cache[require.resolve('./controllers/inventoryController.js')]
    ];
    
    for (const moduleKey in require.cache) {
      if (moduleKey.includes('services/inventoryService') || 
          moduleKey.includes('routes/inventory') ||
          moduleKey.includes('controllers/inventoryController')) {
        delete require.cache[moduleKey];
      }
    }
    
    console.log('✅ Moduli ricaricati dalla cache');
    res.json({ 
      success: true, 
      message: 'Moduli ricaricati con successo',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('❌ Errore reload moduli:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: APP_VERSION,
    time: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch
  });
});

// Version endpoint
app.get('/api/version', (req, res) => {
  res.json({ version: APP_VERSION, date: new Date().toISOString().split('T')[0] });
});

// Logo endpoint - returns logo data with cache-busting headers
app.get('/api/logo', async (req, res) => {
  try {
    const logoSetting = await prisma.companySettings.findUnique({
      where: { key: 'logoUrl' }
    });
    const logoUrl = logoSetting?.value || 'images/logo INSEGNA.png';
    
    // Set cache-busting headers
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    res.json({ logoUrl, updated: new Date().toISOString() });
  } catch (err) {
    res.json({ logoUrl: 'images/logo INSEGNA.png', updated: new Date().toISOString() });
  }
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/index.html'));
});

// Start server with WebSocket support
// Ascolta su tutte le interfacce (0.0.0.0) per essere accessibile da rete
httpServer.listen(PORT, undefined, async () => {
  try {
    console.log('🚀 Starting server...');
    
    // Connessione Prisma
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Aggiungi i campi mancanti a Trip se non esistono
    console.log('🔧 Checking Trip table schema...');
    try {
      const fieldsToAdd = [
        ['accepted', 'BOOLEAN NOT NULL DEFAULT 0'],
        ['acceptedAt', 'DATETIME'],
        ['printed', 'BOOLEAN NOT NULL DEFAULT 0'],
        ['printedAt', 'DATETIME']
      ];

      for (const [fieldName, fieldType] of fieldsToAdd) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Trip" ADD COLUMN "${fieldName}" ${fieldType}`);
          console.log(`✅ Added column: ${fieldName}`);
        } catch (err: any) {
          // Silently ignore
        }
      }
    } catch (err: any) {
      console.warn('⚠️  Error checking Trip columns:', err.message);
    }

    // Aggiungi i campi snooze a Inventory se non esistono
    console.log('🔧 Checking Inventory snooze columns...');
    try {
      const invFields = [
        ['snoozedAt', 'DATETIME'],
        ['snoozedAtStock', 'INT']
      ];
      for (const [fieldName, fieldType] of invFields) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE \`Inventory\` ADD COLUMN \`${fieldName}\` ${fieldType}`);
          console.log(`✅ Added Inventory column: ${fieldName}`);
        } catch (_e: any) { /* exists */ }
      }
    } catch (err: any) {
      console.warn('⚠️  Error checking Inventory columns:', err.message);
    }

    // Aggiungi i campi stampa ordine interno a Task
    console.log('🔧 Checking Task internalOrder print columns...');
    try {
      const taskFields = [
        ['internalOrderPrintedAt', 'DATETIME'],
        ['internalOrderPrintedById', 'INT']
      ];
      for (const [fieldName, fieldType] of taskFields) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE \`Task\` ADD COLUMN \`${fieldName}\` ${fieldType}`);
          console.log(`✅ Added Task column: ${fieldName}`);
        } catch (_e: any) { /* exists */ }
      }
    } catch (err: any) {
      console.warn('⚠️  Error checking Task columns:', err.message);
    }

    // Fix legacy "Ordine interno" task titles/descriptions: kg -> colli
    console.log('🔧 Normalizing legacy ordine interno units (kg -> colli)...');
    try {
      const tFix = await prisma.$executeRawUnsafe(
        "UPDATE `Task` SET `title` = REGEXP_REPLACE(`title`, '(Ordine interno:.*\\\\s[×x]\\\\s*[0-9]+)\\\\s*kg', '\\\\1 colli') WHERE `title` LIKE '%Ordine interno:%' AND `title` REGEXP '[×x][[:space:]]*[0-9]+[[:space:]]*kg'"
      );
      const dFix = await prisma.$executeRawUnsafe(
        "UPDATE `Task` SET `description` = REGEXP_REPLACE(`description`, '(Giacenza attuale:\\\\s*[0-9]+)\\\\s*kg', '\\\\1 colli') WHERE `description` LIKE '%Giacenza attuale:%kg%'"
      );
      console.log(`✅ Normalizzati: ${tFix} titoli, ${dFix} descrizioni`);
    } catch (err: any) {
      console.warn('⚠️  Normalize ordini interni fallito:', err.message);
    }

    // Inizializza database con utenti di default se vuoto
    await initializeDatabaseIfEmpty(prisma);

    // Setup backup middleware
    setupBackupMiddleware(prisma);

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