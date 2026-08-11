import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma';

const router = Router();

// Directory per upload persistente (nel bind mount)
// In produzione: /app/uploads (bind mount /share/Public/molino-data/uploads sul NAS)
// In sviluppo: ./uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || (
  process.env.NODE_ENV === 'production'
    ? '/app/uploads'
    : path.join(process.cwd(), 'uploads')
);

const APK_UPLOAD_DIR = process.env.APK_UPLOAD_DIR || path.join(UPLOAD_DIR, 'apks');

// Configura multer per upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Crea la directory se non esiste
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Genera nome univoco con timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    let prefix = 'logo';
    if (file.fieldname === 'avatar') prefix = 'avatar';
    if (file.fieldname === 'apk') prefix = 'apk';
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Accetta solo immagini
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo file non supportato. Usa JPEG, PNG, GIF, WebP o SVG.'));
    }
  }
});

const uploadApk = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(APK_UPLOAD_DIR)) {
        fs.mkdirSync(APK_UPLOAD_DIR, { recursive: true });
      }
      cb(null, APK_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `apk-${uniqueSuffix}${ext}`);
    }
  }),
  limits: {
    fileSize: 300 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.android.package-archive',
      'application/octet-stream'
    ];
    const isApkExt = /\.apk$/i.test(file.originalname || '');
    if (allowedTypes.includes(file.mimetype) || isApkExt) {
      cb(null, true);
    } else {
      cb(new Error('Tipo file non supportato. Carica un file APK.'));
    }
  }
});

/**
 * POST /api/upload/logo
 * Upload del logo aziendale
 */
router.post('/logo', authMiddleware, upload.single('logo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nessun file caricato' });
    }

    // URL per accedere al file (serviremo /uploads/ tramite express.static)
    const relativePath = `uploads/${req.file.filename}`;
    
    console.log(`✅ Logo caricato: ${req.file.filename} in ${UPLOAD_DIR}`);
    
    res.json({
      success: true,
      url: relativePath,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error: any) {
    console.error('❌ Errore upload logo:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/upload/user-image
 * Upload immagine per un utente (ritorna solo URL, senza aggiornare il DB)
 */
router.post('/user-image', authMiddleware, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nessun file caricato' });
    }
    const relativePath = `uploads/${req.file.filename}`;
    console.log(`✅ User image caricata: ${req.file.filename}`);
    res.json({
      success: true,
      url: relativePath,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error: any) {
    console.error('❌ Errore upload user-image:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/upload/avatar
 * Upload dell'immagine profilo dell'utente corrente
 */
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nessun file caricato' });
    }
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Non autenticato' });
    }
    const relativePath = `uploads/${req.file.filename}`;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { image: relativePath }
    });
    console.log(`✅ Avatar caricato per utente ${req.user.username}: ${req.file.filename}`);
    res.json({
      success: true,
      url: relativePath,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error: any) {
    console.error('❌ Errore upload avatar:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/upload/apk
 * Upload APK Operator Lite / Android
 */
router.post('/apk', authMiddleware, uploadApk.single('apk'), async (req: Request, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'master') {
      return res.status(403).json({ success: false, message: 'Only master can upload APK files' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nessun file caricato' });
    }

    const relativePath = `uploads/apks/${req.file.filename}`;
    console.log(`✅ APK caricato: ${req.file.filename} in ${APK_UPLOAD_DIR}`);

    res.json({
      success: true,
      url: relativePath,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error: any) {
    console.error('❌ Errore upload APK:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/upload/apks
 * Lista APK caricati
 */
router.get('/apks', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(APK_UPLOAD_DIR)) {
      return res.json({ success: true, apks: [] });
    }

    const files = fs.readdirSync(APK_UPLOAD_DIR)
      .filter(f => /\.apk$/i.test(f))
      .map(filename => ({
        filename,
        url: `uploads/apks/${filename}`,
        size: fs.statSync(path.join(APK_UPLOAD_DIR, filename)).size,
        mtime: fs.statSync(path.join(APK_UPLOAD_DIR, filename)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .map(({ mtime, ...rest }) => rest);

    res.json({ success: true, apks: files });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/upload/logos
 * Lista tutti i loghi caricati
 */
router.get('/logos', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return res.json({ success: true, logos: [] });
    }
    
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f))
      .map(filename => ({
        filename,
        url: `uploads/${filename}`,
        size: fs.statSync(path.join(UPLOAD_DIR, filename)).size
      }));
    
    res.json({ success: true, logos: files });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Esporta UPLOAD_DIR per uso in index.ts (serve per express.static)
export { UPLOAD_DIR };

export default router;
