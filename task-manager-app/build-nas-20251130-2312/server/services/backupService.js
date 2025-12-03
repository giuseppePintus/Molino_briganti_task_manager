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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execPromise = (0, util_1.promisify)(child_process_1.exec);
class BackupService {
    constructor(backupDir = '/share/CACHEDEV1_DATA/molino/backups', nasUrl = '192.168.1.100', nasPort = 5000) {
        this.maxLocalBackups = 10;
        this.backupDir = backupDir;
        this.nasUrl = nasUrl;
        this.nasPort = nasPort;
        // Crea cartella backup se non esiste (con fallback a ./backups se /share/CACHEDEV1_DATA non disponibile)
        if (!fs.existsSync(this.backupDir)) {
            try {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }
            catch (err) {
                console.warn(`⚠️ Cannot create ${this.backupDir}, using ./backups instead`);
                this.backupDir = './backups';
                fs.mkdirSync(this.backupDir, { recursive: true });
            }
        }
    }
    /**
     * Esegui backup del database
     */
    backupDatabase() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupName = `db-backup-${timestamp}.sql`;
                const backupPath = path.join(this.backupDir, backupName);
                // Leggi il percorso del database dal .env (DATABASE_URL)
                const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/data/tasks.db';
                // Estrai il percorso del file da "file:./path/to/db"
                let dbPath = databaseUrl.replace('file:', '');
                // Se il percorso è relativo, risolvi rispetto alla root del server (/app/server in Docker o server/ in locale)
                if (!path.isAbsolute(dbPath)) {
                    // In Docker: process.cwd() = /app/server, dbPath = ./prisma/data/tasks.db → /app/server/prisma/data/tasks.db
                    // In localhost: process.cwd() = .../task-manager-app/server, dbPath relativo
                    dbPath = path.join(process.cwd(), dbPath);
                }
                if (fs.existsSync(dbPath)) {
                    fs.copyFileSync(dbPath, backupPath);
                    console.log(`✅ Database backed up: ${backupPath}`);
                    // Carica su NAS
                    yield this.uploadToNas(backupPath, backupName);
                    // Mantieni solo ultimi N backup locali
                    yield this.cleanOldBackups();
                    return backupPath;
                }
                else {
                    console.warn(`⚠️ Database file not found at ${dbPath} - skipping backup`);
                    return '';
                }
            }
            catch (error) {
                console.error('❌ Backup error:', error);
                // Non lanciare errore - continua comunque
                return '';
            }
        });
    }
    /**
     * Carica backup su NAS
     */
    uploadToNas(filePath, fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                try {
                    const fileContent = fs.readFileSync(filePath);
                    const options = {
                        hostname: this.nasUrl,
                        port: this.nasPort,
                        path: `/api/backup/upload`,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/octet-stream',
                            'X-Backup-Name': fileName,
                            'Content-Length': fileContent.length
                        }
                    };
                    const req = http.request(options, (res) => {
                        if (res.statusCode === 200 || res.statusCode === 201) {
                            console.log(`✅ Backup uploaded to NAS: ${fileName}`);
                            resolve();
                        }
                        else {
                            console.warn(`⚠️ NAS upload returned status ${res.statusCode}`);
                            resolve(); // Non fallire se NAS non disponibile
                        }
                    });
                    req.on('error', (error) => {
                        console.warn(`⚠️ NAS upload failed: ${error.message}`);
                        resolve(); // Non fallire se NAS non disponibile
                    });
                    req.write(fileContent);
                    req.end();
                }
                catch (error) {
                    console.warn(`⚠️ NAS upload error: ${error}`);
                    resolve(); // Non fallire
                }
            });
        });
    }
    /**
     * Scarica backup da NAS
     */
    downloadFromNas(fileName, destinationPath) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                try {
                    const destination = destinationPath || path.join(this.backupDir, fileName);
                    const options = {
                        hostname: this.nasUrl,
                        port: this.nasPort,
                        path: `/api/backup/download/${fileName}`,
                        method: 'GET'
                    };
                    const req = http.request(options, (res) => {
                        if (res.statusCode === 200) {
                            const file = fs.createWriteStream(destination);
                            res.pipe(file);
                            file.on('finish', () => {
                                file.close();
                                console.log(`✅ Backup downloaded from NAS: ${destination}`);
                                resolve(destination);
                            });
                        }
                        else {
                            reject(new Error(`NAS returned status ${res.statusCode}`));
                        }
                    });
                    req.on('error', reject);
                    req.end();
                }
                catch (error) {
                    reject(error);
                }
            });
        });
    }
    /**
     * Ripristina database da backup
     */
    restoreDatabase(backupPath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Leggi il percorso del database dal .env (DATABASE_URL)
                const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/data/tasks.db';
                // Estrai il percorso del file da "file:./path/to/db"
                let dbPath = databaseUrl.replace('file:', '');
                // Se il percorso è relativo, risolvi rispetto alla root del server
                if (!path.isAbsolute(dbPath)) {
                    dbPath = path.join(process.cwd(), dbPath);
                }
                // Backup del database corrente
                if (fs.existsSync(dbPath)) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    fs.copyFileSync(dbPath, path.join(this.backupDir, `db-pre-restore-${timestamp}.sql`));
                }
                // Ripristina
                fs.copyFileSync(backupPath, dbPath);
                console.log(`✅ Database restored from: ${backupPath}`);
            }
            catch (error) {
                console.error('❌ Restore error:', error);
                throw error;
            }
        });
    }
    /**
     * Lista backup disponibili
     */
    listBackups() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const files = fs.readdirSync(this.backupDir);
                const backupFiles = files.filter(f => f.startsWith('db-backup-'));
                // Ritorna array di oggetti con filename, size e createdAt
                const backups = backupFiles.map(filename => {
                    const filePath = path.join(this.backupDir, filename);
                    const stats = fs.statSync(filePath);
                    return {
                        filename: filename,
                        size: stats.size,
                        createdAt: stats.mtime.toISOString()
                    };
                });
                // Ordina per data di modifica (più recenti prima)
                return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            }
            catch (error) {
                console.error('❌ List backups error:', error);
                return [];
            }
        });
    }
    /**
     * Elimina backup vecchi
     */
    cleanOldBackups() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const backups = yield this.listBackups();
                if (backups.length > this.maxLocalBackups) {
                    const toDelete = backups.slice(this.maxLocalBackups);
                    for (const backup of toDelete) {
                        const filename = typeof backup === 'string' ? backup : backup.filename;
                        fs.unlinkSync(path.join(this.backupDir, filename));
                        console.log(`🗑️ Old backup deleted: ${filename}`);
                    }
                }
            }
            catch (error) {
                console.warn('⚠️ Clean old backups error:', error);
            }
        });
    }
    /**
     * Scarica e ripristina ultimo backup dal NAS
     */
    restoreLatestFromNas() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log('📥 Fetching latest backup from NAS...');
                // Richiedi lista backup dal NAS
                const backupList = yield this.getBackupsFromNas();
                if (backupList.length === 0) {
                    console.warn('⚠️ No backups found on NAS');
                    return;
                }
                const latestBackup = backupList[0];
                console.log(`📦 Latest backup: ${latestBackup}`);
                // Scarica
                const downloadedPath = yield this.downloadFromNas(latestBackup);
                // Ripristina
                yield this.restoreDatabase(downloadedPath);
            }
            catch (error) {
                console.error('❌ Restore from NAS error:', error);
                throw error;
            }
        });
    }
    /**
     * Ottieni lista backup dal NAS
     */
    getBackupsFromNas() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                try {
                    const options = {
                        hostname: this.nasUrl,
                        port: this.nasPort,
                        path: '/api/backup/list',
                        method: 'GET'
                    };
                    const req = http.request(options, (res) => {
                        let data = '';
                        res.on('data', (chunk) => data += chunk);
                        res.on('end', () => {
                            try {
                                const backups = JSON.parse(data);
                                resolve(backups.files || []);
                            }
                            catch (_a) {
                                resolve([]);
                            }
                        });
                    });
                    req.on('error', () => resolve([]));
                    req.end();
                }
                catch (_a) {
                    resolve([]);
                }
            });
        });
    }
    /**
     * Configura backup automatico periodico
     */
    setupAutoBackup(intervalMinutes = 60) {
        console.log(`⏰ Auto backup scheduled every ${intervalMinutes} minutes`);
        return setInterval(() => {
            this.backupDatabase().catch(err => console.error('Auto backup failed:', err));
        }, intervalMinutes * 60 * 1000);
    }
}
exports.BackupService = BackupService;
exports.default = new BackupService(process.env.BACKUP_DIR || '/share/CACHEDEV1_DATA/molino/backups', process.env.NAS_URL || '192.168.1.100', parseInt(process.env.NAS_PORT || '5000'));
