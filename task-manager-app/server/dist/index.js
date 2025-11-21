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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const tasks_1 = __importDefault(require("./routes/tasks"));
const auth_1 = __importDefault(require("./routes/auth"));
const backup_1 = __importDefault(require("./routes/backup"));
const backupMiddleware_1 = __importDefault(require("./middleware/backupMiddleware"));
const backupService_1 = __importDefault(require("./services/backupService"));
const databaseInit_1 = require("./services/databaseInit");
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static files
app.use(express_1.default.static(path_1.default.join(__dirname, '../../public')));
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/tasks', tasks_1.default);
app.use('/api/backup', backup_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../public/index.html'));
});
// Start server
app.listen(PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Inizializza database schema con Prisma (crea se non esiste)
        console.log('🗄️ Initializing database schema...');
        try {
            yield prisma.$executeRawUnsafe(`SELECT 1 FROM sqlite_master WHERE type='table' LIMIT 1`);
            console.log('✅ Database schema already exists');
        }
        catch (err) {
            console.log('📝 Database is new, running migrations...');
            // Il database non esiste ancora, Prisma lo creerà al connect
        }
        yield prisma.$connect();
        console.log('✅ Database connected successfully');
        // Inizializza database con utenti di default se vuoto
        yield (0, databaseInit_1.initializeDatabaseIfEmpty)(prisma);
        // Setup backup middleware DOPO connessione
        (0, backupMiddleware_1.default)(prisma);
        // Ripristina ultimo backup dal NAS se disponibile
        try {
            console.log('🔄 Checking for backups on NAS...');
            yield backupService_1.default.restoreLatestFromNas();
        }
        catch (err) {
            console.log('ℹ️ No backups available on NAS (first run)');
        }
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
