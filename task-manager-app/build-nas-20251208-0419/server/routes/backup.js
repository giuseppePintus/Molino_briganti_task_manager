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
const express_1 = require("express");
const backupService_1 = __importDefault(require("../services/backupService"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const router = (0, express_1.Router)();
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
/**
 * GET /api/backup/list
 * Elenca tutti i backup disponibili
 */
router.get('/list', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const backups = yield backupService_1.default.listBackups();
        res.json({
            success: true,
            files: backups.map(b => b.filename), // Per compatibilità backwards
            backups: backups, // Nuovo formato con metadati
            count: backups.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * POST /api/backup/manual
 * Attiva un backup manuale
 */
router.post('/manual', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const backupPath = yield backupService_1.default.backupDatabase();
        res.json({
            success: true,
            message: 'Backup created successfully',
            path: backupPath,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * POST /api/backup/upload
 * Carica un backup da client remoto (usato da client locali)
 */
router.post('/upload', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const backupName = req.headers['x-backup-name'];
        if (!backupName) {
            return res.status(400).json({ error: 'Missing X-Backup-Name header' });
        }
        const backupPath = path.join(BACKUP_DIR, backupName);
        const writeStream = fs.createWriteStream(backupPath);
        req.pipe(writeStream);
        writeStream.on('finish', () => {
            res.json({
                success: true,
                message: 'Backup uploaded successfully',
                path: backupPath
            });
        });
        writeStream.on('error', (error) => {
            res.status(500).json({
                success: false,
                error: error.message
            });
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * GET /api/backup/download/:filename
 * Scarica un backup specifico
 */
router.get('/download/:filename', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filename = decodeURIComponent(req.params.filename);
        // Valida nome file (previeni path traversal)
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        const backupPath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }
        res.download(backupPath, filename);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * POST /api/backup/restore/:filename
 * Ripristina database da backup specifico
 */
router.post('/restore/:filename', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let filename = decodeURIComponent(req.params.filename);
        // Valida nome file
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        const backupPath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }
        yield backupService_1.default.restoreDatabase(backupPath);
        res.json({
            success: true,
            message: 'Database restored successfully',
            path: backupPath,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * POST /api/backup/restore-latest
 * Ripristina l'ultimo backup disponibile dal NAS
 */
router.post('/restore-latest', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield backupService_1.default.restoreLatestFromNas();
        res.json({
            success: true,
            message: 'Latest backup restored successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * DELETE /api/backup/:filename
 * Elimina un backup specifico
 */
router.delete('/:filename', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const filename = decodeURIComponent(req.params.filename);
        // Valida nome file
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }
        const backupPath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }
        fs.unlinkSync(backupPath);
        res.json({
            success: true,
            message: 'Backup deleted successfully',
            filename: filename
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * GET /api/backup/status
 * Stato del sistema di backup
 */
router.get('/status', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const backups = yield backupService_1.default.listBackups();
        const latestBackup = backups[0] || null;
        res.json({
            success: true,
            system: 'Automated Backup System',
            status: 'running',
            backupsCount: backups.length,
            latestBackup: latestBackup,
            nasUrl: process.env.NAS_URL || '192.168.1.248',
            nasPort: process.env.NAS_PORT || '5000',
            backupDir: process.env.BACKUP_DIR || '/data/molino/backups/database',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * POST /api/backup/settings/path
 * Salva i percorsi personalizzati per i backup
 */
router.post('/settings/path', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pathType, path: backupPath } = req.body;
        // Validazione
        if (!pathType || !backupPath) {
            return res.status(400).json({
                success: false,
                error: 'Missing pathType or path'
            });
        }
        const validPathTypes = ['local', 'nas', 'cloud'];
        if (!validPathTypes.includes(pathType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid pathType. Must be: local, nas, or cloud'
            });
        }
        // Salva in environment variables o file di configurazione
        const backupConfig = {
            local: process.env.BACKUP_DIR_LOCAL || './backups',
            nas: process.env.BACKUP_DIR_NAS || '',
            cloud: process.env.BACKUP_DIR_CLOUD || ''
        };
        backupConfig[pathType] = backupPath;
        // TODO: Salva in file di configurazione (config.json)
        // Per adesso, usa le variabili di ambiente
        if (pathType === 'local')
            process.env.BACKUP_DIR_LOCAL = backupPath;
        if (pathType === 'nas')
            process.env.BACKUP_DIR_NAS = backupPath;
        if (pathType === 'cloud')
            process.env.BACKUP_DIR_CLOUD = backupPath;
        res.json({
            success: true,
            message: `${pathType} backup path updated successfully`,
            config: backupConfig,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * GET /api/backup/settings/paths
 * Recupera i percorsi di backup configurati
 */
router.get('/settings/paths', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Percorso interno container: /data/molino/backups/database
        // Mappato su NAS a: /share/Container/data/molino/backups/database
        // Visibile da Windows: \\NAS71F89C\Container\data\molino\backups\database
        const defaultPath = '/data/molino/backups/database';
        res.json({
            success: true,
            paths: {
                local: process.env.BACKUP_DIR || defaultPath,
                nas: process.env.BACKUP_DIR_NAS || defaultPath,
                cloud: process.env.BACKUP_DIR_CLOUD || 'Not configured'
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * GET /api/backup/auto-backup/settings
 * Ottiene le impostazioni dell'auto-backup
 */
router.get('/auto-backup/settings', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const settings = backupService_1.default.getAutoBackupSettings();
        res.json({
            success: true,
            settings: settings,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * POST /api/backup/auto-backup/settings
 * Aggiorna le impostazioni dell'auto-backup
 */
router.post('/auto-backup/settings', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { enabled, intervalHours } = req.body;
        // Validazione
        if (enabled !== undefined && typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'enabled must be a boolean'
            });
        }
        if (intervalHours !== undefined) {
            const hours = Number(intervalHours);
            if (isNaN(hours) || hours < 1 || hours > 168) {
                return res.status(400).json({
                    success: false,
                    error: 'intervalHours must be a number between 1 and 168'
                });
            }
        }
        const updatedSettings = backupService_1.default.updateAutoBackupSettings({
            enabled: enabled,
            intervalHours: intervalHours ? Number(intervalHours) : undefined
        });
        res.json({
            success: true,
            message: enabled ? 'Auto-backup enabled' : 'Auto-backup disabled',
            settings: updatedSettings,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * POST /api/backup/auto-backup/start
 * Avvia l'auto-backup
 */
router.post('/auto-backup/start', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { intervalHours } = req.body;
        const hours = intervalHours ? Number(intervalHours) : 24;
        if (hours < 1 || hours > 168) {
            return res.status(400).json({
                success: false,
                error: 'intervalHours must be between 1 and 168'
            });
        }
        backupService_1.default.startAutoBackup(hours);
        res.json({
            success: true,
            message: `Auto-backup started with interval of ${hours} hours`,
            settings: backupService_1.default.getAutoBackupSettings(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
/**
 * POST /api/backup/auto-backup/stop
 * Ferma l'auto-backup
 */
router.post('/auto-backup/stop', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        backupService_1.default.stopAutoBackup();
        res.json({
            success: true,
            message: 'Auto-backup stopped',
            settings: backupService_1.default.getAutoBackupSettings(),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}));
exports.default = router;
