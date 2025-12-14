"use strict";
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
exports.UPLOAD_DIR = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// Directory per upload persistente (nel bind mount)
// In produzione: /data/molino/uploads
// In sviluppo: ./uploads
const UPLOAD_DIR = process.env.NODE_ENV === 'production'
    ? '/data/molino/uploads'
    : path_1.default.join(process.cwd(), 'uploads');
exports.UPLOAD_DIR = UPLOAD_DIR;
// Configura multer per upload file
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        // Crea la directory se non esiste
        if (!fs_1.default.existsSync(UPLOAD_DIR)) {
            fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Genera nome univoco con timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, `logo-${uniqueSuffix}${ext}`);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
        // Accetta solo immagini
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Tipo file non supportato. Usa JPEG, PNG, GIF, WebP o SVG.'));
        }
    }
});
/**
 * POST /api/upload/logo
 * Upload del logo aziendale
 */
router.post('/logo', auth_1.authMiddleware, upload.single('logo'), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    }
    catch (error) {
        console.error('❌ Errore upload logo:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}));
/**
 * GET /api/upload/logos
 * Lista tutti i loghi caricati
 */
router.get('/logos', auth_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!fs_1.default.existsSync(UPLOAD_DIR)) {
            return res.json({ success: true, logos: [] });
        }
        const files = fs_1.default.readdirSync(UPLOAD_DIR)
            .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f))
            .map(filename => ({
            filename,
            url: `uploads/${filename}`,
            size: fs_1.default.statSync(path_1.default.join(UPLOAD_DIR, filename)).size
        }));
        res.json({ success: true, logos: files });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}));
exports.default = router;
