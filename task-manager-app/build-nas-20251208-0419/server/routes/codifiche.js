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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const CODIFICHE_CSV_PATH = path.join(process.cwd(), 'public/data/codifica articoli.csv');
// Helper per leggere il CSV
function readCodifiche() {
    try {
        const content = fs.readFileSync(CODIFICHE_CSV_PATH, 'utf-8');
        const lines = content.split('\n');
        const result = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            // Rimuovi BOM se presente
            if (i === 0 && line.charCodeAt(0) === 0xFEFF) {
                line = line.slice(1);
            }
            line = line.trim();
            // Salta righe vuote, linee con solo virgole, linee con solo spazi
            if (!line || line === ',' || line === '' || /^\s*$/.test(line)) {
                continue;
            }
            // Deve avere almeno una virgola
            const commaIndex = line.indexOf(',');
            if (commaIndex === -1) {
                console.warn(`⚠️  NO COMMA AT LINE ${i + 1}: [${line}]`);
                continue;
            }
            const codice = line.substring(0, commaIndex).trim();
            const descrizione = line.substring(commaIndex + 1).trim();
            // Salta se codice è vuoto
            if (!codice || codice === '') {
                console.warn(`⚠️  EMPTY CODICE AT LINE ${i + 1}: [${line}]`);
                continue;
            }
            result.push({ codice, descrizione });
        }
        console.log(`✅ readCodifiche: Loaded ${result.length} items`);
        return result;
    }
    catch (error) {
        console.error('Errore lettura codifiche:', error);
        return [];
    }
}
// Helper per salvare il CSV
function saveCodifiche(codifiche) {
    try {
        const csv = codifiche.map(c => `${c.codice},${c.descrizione}`).join('\n');
        fs.writeFileSync(CODIFICHE_CSV_PATH, csv, 'utf-8');
        console.log('✅ Codifiche salvate');
        return true;
    }
    catch (error) {
        console.error('❌ Errore salvataggio codifiche:', error);
        return false;
    }
}
// Leggi tutte le codifiche
router.get('/list', auth_1.authMiddleware, (req, res) => {
    try {
        const codifiche = readCodifiche();
        console.log(`✅ Codifiche loaded: ${codifiche.length} items`);
        codifiche.forEach((c, i) => {
            console.log(`  [${i}] codice="${c.codice}" descrizione="${c.descrizione}"`);
        });
        res.json(codifiche);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Crea nuova codifica
router.post('/create', auth_1.authMiddleware, (req, res) => {
    try {
        const { codice, descrizione } = req.body;
        if (!codice || !descrizione) {
            return res.status(400).json({ error: 'Campi obbligatori: codice, descrizione' });
        }
        const codifiche = readCodifiche();
        // Verifica che il codice non esista già
        if (codifiche.some(c => c.codice === codice)) {
            return res.status(409).json({ error: 'Codice già esistente' });
        }
        codifiche.push({ codice, descrizione });
        if (saveCodifiche(codifiche)) {
            res.json({ success: true, message: 'Codifica creata', codice });
        }
        else {
            res.status(500).json({ error: 'Errore nel salvataggio' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Aggiorna codifica
router.put('/update/:codice', auth_1.authMiddleware, (req, res) => {
    try {
        const { codice } = req.params;
        const { descrizione } = req.body;
        if (!descrizione) {
            return res.status(400).json({ error: 'Campo obbligatorio: descrizione' });
        }
        let codifiche = readCodifiche();
        const index = codifiche.findIndex(c => c.codice === decodeURIComponent(codice));
        if (index === -1) {
            return res.status(404).json({ error: 'Codifica non trovata' });
        }
        codifiche[index].descrizione = descrizione;
        if (saveCodifiche(codifiche)) {
            res.json({ success: true, message: 'Codifica aggiornata' });
        }
        else {
            res.status(500).json({ error: 'Errore nel salvataggio' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Elimina codifica
router.delete('/delete/:codice', auth_1.authMiddleware, (req, res) => {
    try {
        const { codice } = req.params;
        let codifiche = readCodifiche();
        const index = codifiche.findIndex(c => c.codice === decodeURIComponent(codice));
        if (index === -1) {
            return res.status(404).json({ error: 'Codifica non trovata' });
        }
        codifiche.splice(index, 1);
        if (saveCodifiche(codifiche)) {
            res.json({ success: true, message: 'Codifica eliminata' });
        }
        else {
            res.status(500).json({ error: 'Errore nel salvataggio' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
