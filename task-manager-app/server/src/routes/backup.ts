import express, { Router, Request, Response } from 'express';
import BackupService from '../services/backupService';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

/**
 * GET /api/backup/list
 * Elenca tutti i backup disponibili
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const backups = await BackupService.listBackups();
    res.json({ 
      success: true, 
      files: backups,
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

    const backupPath = path.join('./backups', backupName);
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
    const filename = req.params.filename;
    
    // Valida nome file (previeni path traversal)
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const backupPath = path.join('./backups', filename);
    
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
    const filename = req.params.filename;
    
    // Valida nome file
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const backupPath = path.join('./backups', filename);
    
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
    const filename = req.params.filename;
    
    // Valida nome file
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const backupPath = path.join('./backups', filename);
    
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

export default router;
