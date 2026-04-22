"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
// Load environment variables from server/.env
dotenv.config({ path: path_1.default.join(__dirname, '../.env') });
// Load version from package.json
let APP_VERSION = '1.0.0';
try {
    // In production (dist/index.js), package.json is one level up
    // In development (src/index.ts), package.json is two levels up
    const paths = [
        path_1.default.join(__dirname, '../package.json'),
        path_1.default.join(__dirname, '../../package.json')
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
            APP_VERSION = pkg.version || '1.0.0';
            break;
        }
    }
}
catch (e) {
    console.warn('⚠️ Errore caricamento versione:', e);
}
// Check if compiled files have been updated since last boot
// This allows live reload when dist files are updated
const bootMarkerFile = path_1.default.join(__dirname, '.boot-marker');
const inventoryServiceFile = path_1.default.join(__dirname, './services/inventoryService.js');
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
}
catch (e) {
    console.warn('⚠️ Non riesco a scrivere boot marker:', e);
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const tasks_1 = __importDefault(require("./routes/tasks"));
const auth_1 = __importDefault(require("./routes/auth"));
const backup_1 = __importDefault(require("./routes/backup"));
const settings_1 = __importDefault(require("./routes/settings"));
const inventory_1 = __importDefault(require("./routes/inventory"));
const codifiche_1 = __importDefault(require("./routes/codifiche"));
const upload_1 = __importStar(require("./routes/upload"));
const orders_1 = __importDefault(require("./routes/orders"));
const trips_1 = __importDefault(require("./routes/trips"));
const customers_1 = __importDefault(require("./routes/customers"));
const debug_1 = __importDefault(require("./routes/debug"));
const backupMiddleware_1 = __importDefault(require("./middleware/backupMiddleware"));
const backupService_1 = __importDefault(require("./services/backupService"));
const prisma_1 = __importDefault(require("./lib/prisma"));
const databaseInit_1 = require("./services/databaseInit");
const socketService_1 = require("./services/socketService");
// WarehouseService imported lazily in endpoints to avoid sqlite3 dependency issue
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const app = (0, express_1.default)();
const httpServer = http_1.default.createServer(app);
const PORT = process.env.PORT || 5000;
// Inizializza WebSocket
socketService_1.socketService.initialize(httpServer);
// Crea cartella uploads se non esiste
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Cartella uploads creata');
}
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Disable caching for all static files
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});
// Serve static files
const publicPath = path_1.default.join(process.cwd(), 'public');
console.log(`📁 Public directory: ${publicPath}`);
app.use(express_1.default.static(publicPath));
// Serve uploads da directory persistente (bind mount in produzione)
app.use('/uploads', express_1.default.static(upload_1.UPLOAD_DIR));
console.log(`📂 Uploads directory: ${upload_1.UPLOAD_DIR}`);
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/tasks', tasks_1.default);
app.use('/api/backup', backup_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/inventory', inventory_1.default);
app.use('/api/codifiche', codifiche_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/trips', trips_1.default);
app.use('/api/customers', customers_1.default);
app.use('/api/debug', debug_1.default);
// Inline endpoint - List all HTML pages in public dir (for Indice feature)
app.get('/api/pages', (req, res) => {
    try {
        const publicDir = path_1.default.join(process.cwd(), 'public');
        const files = fs.readdirSync(publicDir).filter((f) => f.endsWith('.html'));
        const pages = files.map((f) => {
            let title = f.replace('.html', '').replace(/-/g, ' ');
            try {
                const content = fs.readFileSync(path_1.default.join(publicDir, f), 'utf8');
                const match = content.match(/<title>([^<]+)<\/title>/i);
                if (match)
                    title = match[1].replace(/ - Molino Briganti/i, '').trim();
            }
            catch (_a) { }
            return { file: f, title };
        });
        res.json(pages);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Inline endpoint - Import warehouse from PDF
app.post('/api/warehouse/import-from-pdf', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('📄 [INLINE] Warehouse PDF import requested');
        const result = yield (require('./services/warehouseService').WarehouseService).importFromPdf();
        res.json({
            success: true,
            message: 'Warehouse imported successfully',
            data: result
        });
    }
    catch (error) {
        console.error('❌ [INLINE] Warehouse import error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
// Inline endpoint - Get warehouse articles
app.get('/api/warehouse/articles', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const articles = yield (require('./services/warehouseService').WarehouseService).getAllArticles();
        res.json({
            success: true,
            data: articles
        });
    }
    catch (error) {
        console.error('❌ [INLINE] Get warehouse articles error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
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
    }
    catch (err) {
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
app.get('/api/logo', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const logoSetting = yield prisma_1.default.companySettings.findUnique({
            where: { key: 'logoUrl' }
        });
        const logoUrl = (logoSetting === null || logoSetting === void 0 ? void 0 : logoSetting.value) || 'images/logo INSEGNA.png';
        // Set cache-busting headers
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.json({ logoUrl, updated: new Date().toISOString() });
    }
    catch (err) {
        res.json({ logoUrl: 'images/logo INSEGNA.png', updated: new Date().toISOString() });
    }
}));
// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(process.cwd(), 'public/index.html'));
});
// Start server with WebSocket support
// Ascolta su tutte le interfacce (0.0.0.0) per essere accessibile da rete
httpServer.listen(PORT, undefined, () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🚀 Starting server...');
        // Connessione Prisma
        yield prisma_1.default.$connect();
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
                    yield prisma_1.default.$executeRawUnsafe(`ALTER TABLE "Trip" ADD COLUMN "${fieldName}" ${fieldType}`);
                    console.log(`✅ Added column: ${fieldName}`);
                }
                catch (err) {
                    // Silently ignore
                }
            }
        }
        catch (err) {
            console.warn('⚠️  Error checking Trip columns:', err.message);
        }
        // Inizializza database con utenti di default se vuoto
        yield (0, databaseInit_1.initializeDatabaseIfEmpty)(prisma_1.default);
        // Setup backup middleware
        (0, backupMiddleware_1.default)(prisma_1.default);
        // Attiva backup automatico ogni ora
        backupService_1.default.setupAutoBackup(60);
        // Backup iniziale
        try {
            yield backupService_1.default.backupDatabase();
        }
        catch (err) {
            console.warn('⚠️ Initial backup failed:', err);
        }
        console.log(`✅ Server is running on port ${PORT}`);
        console.log(`🌐 Web UI: http://localhost:${PORT}`);
        console.log(`💾 Backup API: http://localhost:${PORT}/api/backup`);
        console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    }
    catch (err) {
        console.error('❌ Database connection error:', err);
        process.exit(1);
    }
}));
// Graceful shutdown
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma_1.default.$disconnect();
    process.exit(0);
}));
