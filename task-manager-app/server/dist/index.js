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
// Load environment variables from server/.env
dotenv.config({ path: path_1.default.join(__dirname, '../.env') });
// Load version from package.json
const packageJson = require('../../package.json');
const APP_VERSION = packageJson.version || '1.0.0';
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const client_1 = require("@prisma/client");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
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
const backupMiddleware_1 = __importDefault(require("./middleware/backupMiddleware"));
const backupService_1 = __importDefault(require("./services/backupService"));
const databaseInit_1 = require("./services/databaseInit");
const socketService_1 = require("./services/socketService");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const app = (0, express_1.default)();
const httpServer = http_1.default.createServer(app);
const prisma = new client_1.PrismaClient();
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
app.use(express_1.default.static(path_1.default.join(__dirname, '../../public')));
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
    res.sendFile(path_1.default.join(__dirname, '../../public/index.html'));
});
// Start server with WebSocket support
httpServer.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
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
        yield prisma.$connect();
        console.log('✅ Database connected successfully');
        // Inizializza database con utenti di default se vuoto
        yield (0, databaseInit_1.initializeDatabaseIfEmpty)(prisma);
        // Setup backup middleware DOPO connessione
        (0, backupMiddleware_1.default)(prisma);
        // Ripristina ultimo backup dal NAS se disponibile (DISABLED for testing)
        // try {
        //   console.log('🔄 Checking for backups on NAS...');
        //   await BackupService.restoreLatestFromNas();
        // } catch (err) {
        //   console.log('ℹ️ No backups available on NAS (first run)');
        // }
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
    yield prisma.$disconnect();
    process.exit(0);
}));
