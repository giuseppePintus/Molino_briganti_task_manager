import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class BackupService {
  private backupDir: string;
  private nasUrl: string;
  private nasPort: number;
  private maxLocalBackups: number = 10;

  constructor(backupDir: string = '/share/CACHEDEV1_DATA/molino/backups', nasUrl: string = '192.168.1.100', nasPort: number = 5000) {
    this.backupDir = backupDir;
    this.nasUrl = nasUrl;
    this.nasPort = nasPort;
    
    // Crea cartella backup se non esiste (con fallback a ./backups se /share/CACHEDEV1_DATA non disponibile)
    if (!fs.existsSync(this.backupDir)) {
      try {
        fs.mkdirSync(this.backupDir, { recursive: true });
      } catch (err) {
        console.warn(`⚠️ Cannot create ${this.backupDir}, using ./backups instead`);
        this.backupDir = './backups';
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    }
  }

  /**
   * Esegui backup del database
   */
  async backupDatabase(): Promise<string> {
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
        await this.uploadToNas(backupPath, backupName);
        
        // Mantieni solo ultimi N backup locali
        await this.cleanOldBackups();
        
        return backupPath;
      } else {
        console.warn('⚠️ Database file not found');
        return '';
      }
    } catch (error) {
      console.error('❌ Backup error:', error);
      throw error;
    }
  }

  /**
   * Carica backup su NAS
   */
  private async uploadToNas(filePath: string, fileName: string): Promise<void> {
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
          } else {
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
      } catch (error) {
        console.warn(`⚠️ NAS upload error: ${error}`);
        resolve(); // Non fallire
      }
    });
  }

  /**
   * Scarica backup da NAS
   */
  async downloadFromNas(fileName: string, destinationPath?: string): Promise<string> {
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
          } else {
            reject(new Error(`NAS returned status ${res.statusCode}`));
          }
        });

        req.on('error', reject);
        req.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Ripristina database da backup
   */
  async restoreDatabase(backupPath: string): Promise<void> {
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
    } catch (error) {
      console.error('❌ Restore error:', error);
      throw error;
    }
  }

  /**
   * Lista backup disponibili
   */
  async listBackups(): Promise<any[]> {
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
    } catch (error) {
      console.error('❌ List backups error:', error);
      return [];
    }
  }

  /**
   * Elimina backup vecchi
   */
  private async cleanOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      if (backups.length > this.maxLocalBackups) {
        const toDelete = backups.slice(this.maxLocalBackups);
        for (const backup of toDelete) {
          const filename = typeof backup === 'string' ? backup : backup.filename;
          fs.unlinkSync(path.join(this.backupDir, filename));
          console.log(`🗑️ Old backup deleted: ${filename}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Clean old backups error:', error);
    }
  }

  /**
   * Scarica e ripristina ultimo backup dal NAS
   */
  async restoreLatestFromNas(): Promise<void> {
    try {
      console.log('📥 Fetching latest backup from NAS...');
      
      // Richiedi lista backup dal NAS
      const backupList = await this.getBackupsFromNas();
      if (backupList.length === 0) {
        console.warn('⚠️ No backups found on NAS');
        return;
      }

      const latestBackup = backupList[0];
      console.log(`📦 Latest backup: ${latestBackup}`);
      
      // Scarica
      const downloadedPath = await this.downloadFromNas(latestBackup);
      
      // Ripristina
      await this.restoreDatabase(downloadedPath);
    } catch (error) {
      console.error('❌ Restore from NAS error:', error);
      throw error;
    }
  }

  /**
   * Ottieni lista backup dal NAS
   */
  private async getBackupsFromNas(): Promise<string[]> {
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
            } catch {
              resolve([]);
            }
          });
        });

        req.on('error', () => resolve([]));
        req.end();
      } catch {
        resolve([]);
      }
    });
  }

  /**
   * Configura backup automatico periodico
   */
  setupAutoBackup(intervalMinutes: number = 60): NodeJS.Timer {
    console.log(`⏰ Auto backup scheduled every ${intervalMinutes} minutes`);
    return setInterval(() => {
      this.backupDatabase().catch(err => console.error('Auto backup failed:', err));
    }, intervalMinutes * 60 * 1000);
  }
}

export default new BackupService(
  process.env.BACKUP_DIR || '/share/CACHEDEV1_DATA/molino/backups',
  process.env.NAS_URL || '192.168.1.100',
  parseInt(process.env.NAS_PORT || '5000')
);
