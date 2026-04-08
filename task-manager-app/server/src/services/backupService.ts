import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClientManager } from '../lib/prisma';
import { createReadStream } from 'fs';
import { createGzip } from 'zlib';

const execPromise = promisify(exec);

// Interfaccia per le impostazioni auto-backup
export interface AutoBackupSettings {
  enabled: boolean;
  intervalHours: number;
  lastBackup: string | null;
  nextBackup: string | null;
}

export class BackupService {
  private backupDir: string;
  private nasUrl: string;
  private nasPort: number;
  // Numero massimo di backup da mantenere
  private maxLocalBackups: number = 50;
  private autoBackupTimer: NodeJS.Timeout | null = null;
  private configFilePath: string;
  private autoBackupSettings: AutoBackupSettings = {
    enabled: false,
    intervalHours: 24,
    lastBackup: null,
    nextBackup: null
  };

  constructor(backupDir?: string, nasUrl: string = '192.168.1.248', nasPort: number = 5000) {
    // Strategia di fallback per il backup dir:
    // 1. Usa il parametro backupDir se fornito
    // 2. Altrimenti, prova i percorsi locali
    // 3. Altrimenti, prova il mount Docker
    let selectedBackupDir: string | null = null;

    // Opzione 1: Parametro passato
    if (backupDir && fs.existsSync(backupDir)) {
      selectedBackupDir = backupDir;
      console.log(`📂 Backup directory (from parameter): ${selectedBackupDir}`);
    }
    
    // Opzione 2: Variabile d'ambiente BACKUP_DIR (percorso relativo o assoluto)
    if (!selectedBackupDir && process.env.BACKUP_DIR) {
      const envBackupDir = path.resolve(process.env.BACKUP_DIR);
      if (fs.existsSync(envBackupDir)) {
        selectedBackupDir = envBackupDir;
        console.log(`📂 Backup directory (from BACKUP_DIR env): ${selectedBackupDir}`);
      }
    }

    // Opzione 3: Percorsi locali comuni
    if (!selectedBackupDir) {
      const localPaths = [
        path.resolve('./backups'),
        path.resolve(__dirname, '../../backups'),
        path.resolve(__dirname, '../../../backups'),
      ];
      
      for (const p of localPaths) {
        if (fs.existsSync(p)) {
          selectedBackupDir = p;
          console.log(`📂 Backup directory (from local path): ${selectedBackupDir}`);
          break;
        }
      }
    }

    // Opzione 4: Percorso NAS con struttura dati/molino
    if (!selectedBackupDir) {
      const nasBackupPath = '/data/molino/backups/database';
      if (fs.existsSync(nasBackupPath)) {
        selectedBackupDir = nasBackupPath;
        console.log(`📂 Backup directory (from NAS mount): ${selectedBackupDir}`);
      }
    }

    // Opzione 5: Mount Docker (per compatibilità container)
    if (!selectedBackupDir) {
      const dockerPath = '/backups/database';
      if (fs.existsSync(dockerPath)) {
        selectedBackupDir = dockerPath;
        console.log(`📂 Backup directory (from Docker mount): ${selectedBackupDir}`);
      }
    }

    // Se nessun percorso esiste, creane uno di fallback
    if (!selectedBackupDir) {
      selectedBackupDir = path.resolve('./backups');
      console.warn(`⚠️ No existing backup directory found. Creating fallback: ${selectedBackupDir}`);
      if (!fs.existsSync(selectedBackupDir)) {
        fs.mkdirSync(selectedBackupDir, { recursive: true });
      }
    }

    this.backupDir = selectedBackupDir;
    this.nasUrl = nasUrl;
    this.nasPort = nasPort;
    
    console.log(`📂 Backup directory impostata a: ${this.backupDir}`);
    
    // File di configurazione per le impostazioni auto-backup
    this.configFilePath = path.join(this.backupDir, 'backup-config.json');
    this.loadAutoBackupSettings();
    
    // Avvia auto-backup se era abilitato
    if (this.autoBackupSettings.enabled) {
      console.log('🔄 Restoring auto-backup from saved settings...');
      this.startAutoBackup(this.autoBackupSettings.intervalHours);
    }
  }
  
  /**
   * Carica le impostazioni auto-backup dal file di configurazione
   */
  private loadAutoBackupSettings(): void {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const data = fs.readFileSync(this.configFilePath, 'utf-8');
        this.autoBackupSettings = JSON.parse(data);
        console.log(`⚙️ Auto-backup settings loaded: enabled=${this.autoBackupSettings.enabled}, interval=${this.autoBackupSettings.intervalHours}h`);
      }
    } catch (error) {
      console.warn('⚠️ Could not load auto-backup settings:', error);
    }
  }
  
  /**
   * Salva le impostazioni auto-backup nel file di configurazione
   */
  private saveAutoBackupSettings(): void {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.autoBackupSettings, null, 2));
      console.log('💾 Auto-backup settings saved');
    } catch (error) {
      console.error('❌ Could not save auto-backup settings:', error);
    }
  }

  /**
   * Esegui backup del database + uploads (logo e file)
   */
  async backupDatabase(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `db-backup-${timestamp}.sql`;
      const uploadsBackupName = `uploads-backup-${timestamp}.tar.gz`;
      const backupPath = path.join(this.backupDir, backupName);
      const uploadsBackupPath = path.join(this.backupDir, uploadsBackupName);

      // Leggi DATABASE_URL e determina se è MariaDB/MySQL o SQLite
      const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/data/tasks.db';
      
      if (databaseUrl.startsWith('mysql://')) {
        // MariaDB/MySQL - usa mysqldump
        await this.backupMariaDB(backupPath);
      } else {
        // SQLite - copia il file
        let dbPath = databaseUrl.replace('file:', '');
        if (!path.isAbsolute(dbPath)) {
          dbPath = path.join(process.cwd(), dbPath);
        }
        
        if (fs.existsSync(dbPath)) {
          fs.copyFileSync(dbPath, backupPath);
          console.log(`✅ Database backed up: ${backupPath}`);
        } else {
          console.warn(`⚠️ Database file not found at ${dbPath} - skipping database backup`);
        }
      }
      
      // Backup della cartella uploads (dove sono i logo e gli altri file)
      const uploadsDir = process.env.UPLOAD_DIR || (
        process.env.NODE_ENV === 'production' 
          ? '/data/molino/uploads'
          : path.join(process.cwd(), 'uploads')
      );
      
      if (fs.existsSync(uploadsDir)) {
        await this.backupUploads(uploadsDir, uploadsBackupPath);
        console.log(`✅ Uploads backed up: ${uploadsBackupPath}`);
      } else {
        console.log(`ℹ️ Uploads directory not found at ${uploadsDir} - skipping uploads backup`);
      }
      
      // Carica su NAS
      if (fs.existsSync(backupPath)) {
        await this.uploadToNas(backupPath, backupName);
      }
      if (fs.existsSync(uploadsBackupPath)) {
        await this.uploadToNas(uploadsBackupPath, uploadsBackupName);
      }
      
      // Mantieni solo ultimi N backup locali
      await this.cleanOldBackups();
      
      return backupPath;
    } catch (error) {
      console.error('❌ Backup error:', error);
      // Non lanciare errore - continua comunque
      return '';
    }
  }

  /**
   * Backup MariaDB/MySQL usando mysqldump
   */
  private async backupMariaDB(backupPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Parse DATABASE_URL: mysql://user:pass@host:port/database
        const dbUrl = process.env.DATABASE_URL || '';
        const urlMatch = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
        
        if (!urlMatch) {
          console.error('❌ Invalid DATABASE_URL format for MariaDB');
          reject(new Error('Invalid DATABASE_URL format'));
          return;
        }
        
        const [, user, password, host, port, database] = urlMatch;
        
        // Usa mysqldump per creare il backup
        const dumpCmd = `mysqldump -h${host} -P${port} -u${user} -p${password} ${database}`;
        
        exec(dumpCmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ mysqldump error: ${error.message}`);
            reject(error);
            return;
          }
          
          // Scrivi l'output nel file di backup
          fs.writeFileSync(backupPath, stdout);
          console.log(`✅ MariaDB database backed up: ${backupPath}`);
          resolve();
        });
      } catch (error) {
        console.error('❌ MariaDB backup error:', error);
        reject(error);
      }
    });
  }

  /**
   * Backup della cartella uploads (comprime come tar.gz)
   */
  private async backupUploads(uploadsDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Usa tar per comprimere la cartella
        const tarCmd = process.platform === 'win32'
          ? `powershell -Command "tar -czf '${outputPath}' -C '${path.dirname(uploadsDir)}' '${path.basename(uploadsDir)}'"`
          : `tar -czf '${outputPath}' -C '${path.dirname(uploadsDir)}' '${path.basename(uploadsDir)}'`;
        
        exec(tarCmd, (error, stdout, stderr) => {
          if (error) {
            // Fallback: se tar non disponibile, comprimi manualmente con gzip
            console.warn(`⚠️ tar command failed: ${error.message}, using manual compression`);
            this.backupUploadsManual(uploadsDir, outputPath).then(resolve).catch(reject);
          } else {
            console.log(`✅ Uploads compressed with tar: ${outputPath}`);
            resolve();
          }
        });
      } catch (error) {
        // Fallback: compressione manuale
        this.backupUploadsManual(uploadsDir, outputPath).then(resolve).catch(reject);
      }
    });
  }

  /**
   * Backup manuale degli uploads (copia ricorsiva se tar non disponibile)
   */
  private async backupUploadsManual(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Se tar non disponibile, salva una lista dei file (manifest)
        const files = this.getAllFiles(sourceDir);
        const manifest = {
          timestamp: new Date().toISOString(),
          files: files.map(f => ({
            name: path.relative(sourceDir, f),
            size: fs.statSync(f).size
          }))
        };
        
        // Salva il manifest come JSON compresso
        const gzip = createGzip();
        
        // Crea un file JSON temporaneo con il manifest
        const tempManifestPath = path.join(path.dirname(sourceDir), 'manifest.json');
        fs.writeFileSync(tempManifestPath, JSON.stringify(manifest, null, 2));
        
        const readStream = createReadStream(tempManifestPath);
        const writeStream = fs.createWriteStream(outputPath);
        
        readStream.pipe(gzip).pipe(writeStream);
        
        writeStream.on('finish', () => {
          fs.unlinkSync(tempManifestPath); // Cancella il manifest temporaneo
          console.log(`✅ Uploads backup created (manual): ${outputPath}`);
          resolve();
        });
        
        writeStream.on('error', reject);
        readStream.on('error', reject);
      } catch (error) {
        // Se tutto fallisce, almeno copia i file direttamente
        console.warn(`⚠️ Manual backup failed: ${error}, trying direct copy`);
        try {
          const uploadsBackupDir = path.join(path.dirname(outputPath), 'uploads-data');
          fs.mkdirSync(uploadsBackupDir, { recursive: true });
          this.copyDirectory(sourceDir, uploadsBackupDir);
          console.log(`✅ Uploads copied directly: ${uploadsBackupDir}`);
          resolve();
        } catch (copyError) {
          reject(copyError);
        }
      }
    });
  }

  /**
   * Ottieni ricorsivamente tutti i file in una directory
   */
  private getAllFiles(dirPath: string): string[] {
    let files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files = files.concat(this.getAllFiles(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error reading directory ${dirPath}: ${error}`);
    }
    
    return files;
  }

  /**
   * Copia ricorsivamente una directory
   */
  private copyDirectory(source: string, destination: string): void {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    const files = fs.readdirSync(source);

    for (const file of files) {
      const sourceFile = path.join(source, file);
      const destFile = path.join(destination, file);

      if (fs.statSync(sourceFile).isDirectory()) {
        this.copyDirectory(sourceFile, destFile);
      } else {
        fs.copyFileSync(sourceFile, destFile);
      }
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
   * Ripristina database + uploads da backup
   */
  async restoreDatabase(backupPath: string, uploadsBackupPath?: string): Promise<void> {
    try {
      console.log(`🔌 Inizio ripristino database da: ${backupPath}`);

      const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/data/tasks.db';

      if (databaseUrl.startsWith('mysql://')) {
        // MariaDB/MySQL — importa via mysql CLI
        await this.restoreMariaDB(backupPath);
      } else {
        // SQLite — sostituisce il file
        let dbPath = databaseUrl.replace('file:', '');
        if (!path.isAbsolute(dbPath)) {
          dbPath = path.join(process.cwd(), dbPath);
        }

        console.log('🔌 Disconnessione Prisma...');
        await PrismaClientManager.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Safety backup del db corrente
        if (fs.existsSync(dbPath)) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const safetyBackupPath = path.join(this.backupDir, `db-pre-restore-${timestamp}.sql`);
          console.log(`💾 Creazione backup di sicurezza: ${safetyBackupPath}`);
          fs.copyFileSync(dbPath, safetyBackupPath);
        }

        console.log(`🚚 Sostituzione file database: ${dbPath}`);
        fs.copyFileSync(backupPath, dbPath);
        console.log(`✅ File database ripristinato con successo`);

        console.log('🔄 Riconnessione Prisma...');
        await PrismaClientManager.resetConnection();

        // Allineamento schema
        try {
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          const schemaPath = 'server/prisma/schema.prisma';
          await execAsync(`npx prisma db push --schema=${schemaPath} --accept-data-loss`);
          console.log('✅ Schema database allineato');
        } catch (schemaError) {
          console.warn('⚠️ Allineamento schema fallito (potrebbe non essere critico):', schemaError);
        }
      }

      // Ripristina gli uploads se fornito
      if (uploadsBackupPath && fs.existsSync(uploadsBackupPath)) {
        try {
          console.log(`📦 Ripristino uploads da: ${uploadsBackupPath}`);
          await this.restoreUploads(uploadsBackupPath);
          console.log(`✅ Uploads ripristinati`);
        } catch (uploadError) {
          console.warn(`⚠️ Errore ripristino uploads: ${uploadError}`);
        }
      }

      console.log('✅ Ripristino completato con successo');
    } catch (error) {
      console.error('❌ Errore critico durante il ripristino:', error);
      throw error;
    }
  }

  /**
   * Ripristina database MariaDB/MySQL importando un file SQL tramite mysql CLI
   */
  private async restoreMariaDB(backupPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const dbUrl = process.env.DATABASE_URL || '';
        const urlMatch = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
        if (!urlMatch) {
          reject(new Error('Invalid DATABASE_URL format for MariaDB'));
          return;
        }
        const [, user, password, host, port, database] = urlMatch;

        // Safety backup prima di sovrascrivere
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safetyBackupPath = path.join(this.backupDir, `db-pre-restore-${timestamp}.sql`);
        const dumpCmd = `mysqldump -h${host} -P${port} -u${user} -p${password} ${database}`;

        exec(dumpCmd, { maxBuffer: 50 * 1024 * 1024 }, (dumpErr, dumpOut) => {
          if (!dumpErr && dumpOut) {
            fs.writeFileSync(safetyBackupPath, dumpOut);
            console.log(`💾 Safety backup creato: ${safetyBackupPath}`);
          }

          // Importa il backup
          console.log(`🚚 Importazione SQL nel database MariaDB: ${database}`);
          const importCmd = `mysql -h${host} -P${port} -u${user} -p${password} ${database}`;
          const mysqlProcess = exec(importCmd, { maxBuffer: 50 * 1024 * 1024 }, (importErr) => {
            if (importErr) {
              console.error(`❌ mysql import error: ${importErr.message}`);
              reject(importErr);
            } else {
              console.log('✅ MariaDB database ripristinato con successo');
              resolve();
            }
          });

          // Invia il file SQL come stdin
          const sqlStream = fs.createReadStream(backupPath);
          sqlStream.pipe(mysqlProcess.stdin!);
          sqlStream.on('error', (e) => reject(e));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Ripristina la cartella uploads da backup
   */
  private async restoreUploads(backupPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const uploadsDir = process.env.UPLOAD_DIR || (
          process.env.NODE_ENV === 'production' 
            ? '/data/molino/uploads'
            : path.join(process.cwd(), 'uploads')
        );

        // Crea la directory uploads se non esiste
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Se è un file tar.gz
        if (backupPath.endsWith('.tar.gz')) {
          const tarCmd = process.platform === 'win32'
            ? `powershell -Command "tar -xzf '${backupPath}' -C '${path.dirname(uploadsDir)}'"`
            : `tar -xzf '${backupPath}' -C '${path.dirname(uploadsDir)}'`;
          
          exec(tarCmd, (error) => {
            if (error) {
              console.warn(`⚠️ tar extraction failed: ${error.message}, trying manual restore`);
              this.restoreUploadsManual(backupPath, uploadsDir).then(resolve).catch(reject);
            } else {
              console.log(`✅ Uploads extracted from tar.gz`);
              resolve();
            }
          });
        } else {
          // Se è una directory di backup manuale
          this.restoreUploadsManual(backupPath, uploadsDir).then(resolve).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Ripristino manuale degli uploads
   */
  private async restoreUploadsManual(backupPath: string, targetDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (fs.statSync(backupPath).isDirectory()) {
          // Se il backup è una directory, copia ricorsivamente
          this.copyDirectory(backupPath, targetDir);
          console.log(`✅ Uploads restored from directory: ${targetDir}`);
          resolve();
        } else if (backupPath.endsWith('.tar.gz')) {
          // Se è compresso, prova a decomprimere
          const gunzip = require('zlib').createGunzip();
          const tar = require('tar');
          
          const readStream = createReadStream(backupPath);
          readStream
            .pipe(gunzip)
            .pipe(tar.extract({ cwd: path.dirname(targetDir) }))
            .on('finish', () => {
              console.log(`✅ Uploads restored from compressed backup`);
              resolve();
            })
            .on('error', reject);
        } else {
          reject(new Error('Unknown backup format'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Lista backup disponibili (db + uploads) - supporta sia SQLite che MariaDB
   */
  async listBackups(): Promise<any[]> {
    try {
      const allBackups: any[] = [];
      
      // 1. Cerca backup nella directory principale (formato db-backup-*.sql)
      const files = fs.readdirSync(this.backupDir);
      const backupFiles = files.filter(f => f.startsWith('db-backup-') && f.endsWith('.sql'));
      const uploadsBackupFiles = files.filter(f => f.startsWith('uploads-backup-'));
      
      for (const filename of backupFiles) {
        const filePath = path.join(this.backupDir, filename);
        const stats = fs.statSync(filePath);
        const timestamp = filename.replace('db-backup-', '').replace('.sql', '');
        const uploadsFile = uploadsBackupFiles.find(f => f.includes(timestamp));
        
        allBackups.push({
          filename: filename,
          uploadsFilename: uploadsFile || null,
          size: stats.size,
          uploadsSize: uploadsFile ? fs.statSync(path.join(this.backupDir, uploadsFile)).size : 0,
          createdAt: stats.mtime.toISOString(),
          type: 'sqlite'
        });
      }
      
      // 2. Cerca backup MariaDB nella sottocartella mariadb/ (formato mariadb-backup-*.sql.gz)
      const mariadbDir = path.join(this.backupDir, 'mariadb');
      if (fs.existsSync(mariadbDir)) {
        const mariadbFiles = fs.readdirSync(mariadbDir);
        const mariadbBackups = mariadbFiles.filter(f => f.startsWith('mariadb-backup-') && (f.endsWith('.sql') || f.endsWith('.sql.gz')));
        
        for (const filename of mariadbBackups) {
          const filePath = path.join(mariadbDir, filename);
          const stats = fs.statSync(filePath);
          
          allBackups.push({
            filename: `mariadb/${filename}`,
            uploadsFilename: null,
            size: stats.size,
            uploadsSize: 0,
            createdAt: stats.mtime.toISOString(),
            type: 'mariadb'
          });
        }
      }
      
      // Ordina per data di modifica (più recenti prima)
      return allBackups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('❌ List backups error:', error);
      return [];
    }
  }

  /**
   * Elimina backup vecchi (sia db che uploads)
   */
  private async cleanOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      if (backups.length > this.maxLocalBackups) {
        const toDelete = backups.slice(this.maxLocalBackups);
        for (const backup of toDelete) {
          // Cancella il database backup
          const dbFilename = typeof backup === 'string' ? backup : backup.filename;
          const dbPath = path.join(this.backupDir, dbFilename);
          if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            console.log(`🗑️ Old backup deleted: ${dbFilename}`);
          }
          
          // Cancella il corrispondente uploads backup
          if (backup.uploadsFilename) {
            const uploadsPath = path.join(this.backupDir, backup.uploadsFilename);
            if (fs.existsSync(uploadsPath)) {
              fs.unlinkSync(uploadsPath);
              console.log(`🗑️ Old uploads backup deleted: ${backup.uploadsFilename}`);
            }
          }
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
      console.warn('⚠️ Restore from NAS skipped (NAS not reachable)');
      // Non fare throw - il NAS potrebbe non essere raggiungibile in localhost
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
          method: 'GET',
          timeout: 5000  // 5 secondi timeout
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

        // Timeout per evitare blocchi
        req.setTimeout(5000, () => {
          req.destroy();
          resolve([]);
        });

        req.on('error', () => resolve([]));
        req.end();
      } catch {
        resolve([]);
      }
    });
  }

  /**
   * Avvia il backup automatico
   */
  startAutoBackup(intervalHours: number = 24): void {
    // Ferma eventuali timer esistenti
    this.stopAutoBackup();
    
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const now = new Date();
    const nextBackupTime = new Date(now.getTime() + intervalMs);
    
    this.autoBackupSettings.enabled = true;
    this.autoBackupSettings.intervalHours = intervalHours;
    this.autoBackupSettings.nextBackup = nextBackupTime.toISOString();
    this.saveAutoBackupSettings();
    
    console.log(`⏰ Auto backup STARTED: every ${intervalHours} hours`);
    console.log(`📅 Next backup scheduled for: ${nextBackupTime.toLocaleString()}`);
    
    // Imposta il timer
    this.autoBackupTimer = setInterval(async () => {
      console.log('⏰ Auto backup triggered...');
      try {
        const backupPath = await this.backupDatabase();
        if (backupPath) {
          this.autoBackupSettings.lastBackup = new Date().toISOString();
          this.autoBackupSettings.nextBackup = new Date(Date.now() + intervalMs).toISOString();
          this.saveAutoBackupSettings();
          console.log(`✅ Auto backup completed: ${backupPath}`);
        }
      } catch (error) {
        console.error('❌ Auto backup failed:', error);
      }
    }, intervalMs);
  }
  
  /**
   * Ferma il backup automatico
   */
  stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
      console.log('⏹️ Auto backup STOPPED');
    }
    
    this.autoBackupSettings.enabled = false;
    this.autoBackupSettings.nextBackup = null;
    this.saveAutoBackupSettings();
  }
  
  /**   * Ottiene la cartella dei backup
   */
  getBackupDir(): string {
    return this.backupDir;
  }

  /**   * Ottieni le impostazioni correnti dell'auto-backup
   */
  getAutoBackupSettings(): AutoBackupSettings {
    return { ...this.autoBackupSettings };
  }
  
  /**
   * Aggiorna le impostazioni dell'auto-backup
   */
  updateAutoBackupSettings(settings: Partial<AutoBackupSettings>): AutoBackupSettings {
    // Aggiorna solo i campi forniti
    if (settings.intervalHours !== undefined) {
      this.autoBackupSettings.intervalHours = settings.intervalHours;
    }
    
    // Se enabled cambia, avvia/ferma il timer
    if (settings.enabled !== undefined) {
      if (settings.enabled && !this.autoBackupSettings.enabled) {
        this.startAutoBackup(this.autoBackupSettings.intervalHours);
      } else if (!settings.enabled && this.autoBackupSettings.enabled) {
        this.stopAutoBackup();
      } else if (settings.enabled && settings.intervalHours !== undefined) {
        // Se già abilitato e cambia l'intervallo, riavvia
        this.startAutoBackup(settings.intervalHours);
      }
    }
    
    return this.getAutoBackupSettings();
  }
  
  /**
   * Configura backup automatico periodico (legacy method per compatibilità)
   */
  setupAutoBackup(intervalMinutes: number = 60): NodeJS.Timeout {
    const intervalHours = intervalMinutes / 60;
    this.startAutoBackup(intervalHours);
    return this.autoBackupTimer!;
  }
}

export default new BackupService(
  process.env.BACKUP_DIR || '/share/Container/data/molino/backups/database',
  process.env.NAS_URL || '192.168.1.248',
  parseInt(process.env.NAS_PORT || '5000')
);
