import express, { Router, Request, Response } from 'express';
import BackupService from '../services/backupService';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

/**
 * GET /api/backup/list
 * Elenca tutti i backup disponibili
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const backups = await BackupService.listBackups();
    res.json({ 
      success: true, 
      files: backups.map(b => b.filename),  // Per compatibilità backwards
      backups: backups,  // Nuovo formato con metadati
      count: backups.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/backup/manual
 * Attiva un backup manuale
 */
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const backupPath = await BackupService.backupDatabase();
    res.json({ 
      success: true, 
      message: 'Backup created successfully',
      path: backupPath,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/backup/upload
 * Carica un backup da client remoto (usato da client locali)
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const backupName = req.headers['x-backup-name'] as string;
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
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/backup/download/:filename
 * Scarica un backup specifico
 */
router.get('/download/:filename', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/backup/restore/:filename
 * Ripristina database da backup specifico
 */
router.post('/restore/:filename', async (req: Request, res: Response) => {
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

    await BackupService.restoreDatabase(backupPath);
    
    res.json({ 
      success: true, 
      message: 'Database restored successfully',
      path: backupPath,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/backup/restore-latest
 * Ripristina l'ultimo backup disponibile dal NAS
 */
router.post('/restore-latest', async (req: Request, res: Response) => {
  try {
    await BackupService.restoreLatestFromNas();
    res.json({ 
      success: true, 
      message: 'Latest backup restored successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /api/backup/:filename
 * Elimina un backup specifico
 */
router.delete('/:filename', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/backup/status
 * Stato del sistema di backup
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const backups = await BackupService.listBackups();
    const latestBackup = backups[0] || null;
    
    res.json({ 
      success: true,
      system: 'Automated Backup System',
      status: 'running',
      backupsCount: backups.length,
      latestBackup: latestBackup,
      nasUrl: process.env.NAS_URL || '192.168.1.100',
      nasPort: process.env.NAS_PORT || '5000',
      backupDir: process.env.BACKUP_DIR || './backups',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/backup/settings/path
 * Salva i percorsi personalizzati per i backup
 */
router.post('/settings/path', async (req: Request, res: Response) => {
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

    backupConfig[pathType as keyof typeof backupConfig] = backupPath;

    // TODO: Salva in file di configurazione (config.json)
    // Per adesso, usa le variabili di ambiente
    if (pathType === 'local') process.env.BACKUP_DIR_LOCAL = backupPath;
    if (pathType === 'nas') process.env.BACKUP_DIR_NAS = backupPath;
    if (pathType === 'cloud') process.env.BACKUP_DIR_CLOUD = backupPath;

    res.json({
      success: true,
      message: `${pathType} backup path updated successfully`,
      config: backupConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/backup/settings/paths
 * Recupera i percorsi di backup configurati
 */
router.get('/settings/paths', async (req: Request, res: Response) => {
  try {
    // Percorso interno container: /data/molino/backups/database
    // Mappato su NAS a: /share/CACHEDEV1_DATA/Container/data/molino/backups/database
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
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/backup/auto-backup/settings
 * Ottiene le impostazioni dell'auto-backup
 */
router.get('/auto-backup/settings', async (req: Request, res: Response) => {
  try {
    const settings = BackupService.getAutoBackupSettings();
    res.json({
      success: true,
      settings: settings,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/backup/auto-backup/settings
 * Aggiorna le impostazioni dell'auto-backup
 */
router.post('/auto-backup/settings', async (req: Request, res: Response) => {
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
    
    const updatedSettings = BackupService.updateAutoBackupSettings({
      enabled: enabled,
      intervalHours: intervalHours ? Number(intervalHours) : undefined
    });
    
    res.json({
      success: true,
      message: enabled ? 'Auto-backup enabled' : 'Auto-backup disabled',
      settings: updatedSettings,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/backup/auto-backup/start
 * Avvia l'auto-backup
 */
router.post('/auto-backup/start', async (req: Request, res: Response) => {
  try {
    const { intervalHours } = req.body;
    const hours = intervalHours ? Number(intervalHours) : 24;
    
    if (hours < 1 || hours > 168) {
      return res.status(400).json({
        success: false,
        error: 'intervalHours must be between 1 and 168'
      });
    }
    
    BackupService.startAutoBackup(hours);
    
    res.json({
      success: true,
      message: `Auto-backup started with interval of ${hours} hours`,
      settings: BackupService.getAutoBackupSettings(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/backup/auto-backup/stop
 * Ferma l'auto-backup
 */
router.post('/auto-backup/stop', async (req: Request, res: Response) => {
  try {
    BackupService.stopAutoBackup();
    
    res.json({
      success: true,
      message: 'Auto-backup stopped',
      settings: BackupService.getAutoBackupSettings(),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
