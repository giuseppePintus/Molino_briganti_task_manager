import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const CODIFICHE_CSV_PATH = path.join(process.cwd(), 'public/data/codifica articoli.csv');

// Helper per leggere il CSV
function readCodifiche(): Array<{ codice: string; descrizione: string }> {
  try {
    const content = fs.readFileSync(CODIFICHE_CSV_PATH, 'utf-8');
    const lines = content.split('\n');
    const result: Array<{ codice: string; descrizione: string }> = [];
    
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
        console.warn(`⚠️  NO COMMA AT LINE ${i+1}: [${line}]`);
        continue;
      }
      
      const codice = line.substring(0, commaIndex).trim();
      const descrizione = line.substring(commaIndex + 1).trim();
      
      // Salta se codice è vuoto
      if (!codice || codice === '') {
        console.warn(`⚠️  EMPTY CODICE AT LINE ${i+1}: [${line}]`);
        continue;
      }
      
      result.push({ codice, descrizione });
    }
    
    console.log(`✅ readCodifiche: Loaded ${result.length} items`);
    return result;
  } catch (error) {
    console.error('Errore lettura codifiche:', error);
    return [];
  }
}

// Helper per salvare il CSV
function saveCodifiche(codifiche: Array<{ codice: string; descrizione: string }>): boolean {
  try {
    const csv = codifiche.map(c => `${c.codice},${c.descrizione}`).join('\n');
    fs.writeFileSync(CODIFICHE_CSV_PATH, csv, 'utf-8');
    console.log('✅ Codifiche salvate');
    return true;
  } catch (error) {
    console.error('❌ Errore salvataggio codifiche:', error);
    return false;
  }
}

// Leggi tutte le codifiche
router.get('/list', authMiddleware, (req: Request, res: Response) => {
  try {
    const codifiche = readCodifiche();
    console.log(`✅ Codifiche loaded: ${codifiche.length} items`);
    codifiche.forEach((c, i) => {
      console.log(`  [${i}] codice="${c.codice}" descrizione="${c.descrizione}"`);
    });
    res.json(codifiche);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Crea nuova codifica
router.post('/create', authMiddleware, (req: Request, res: Response) => {
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
    } else {
      res.status(500).json({ error: 'Errore nel salvataggio' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Aggiorna codifica
router.put('/update/:codice', authMiddleware, (req: Request, res: Response) => {
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
    } else {
      res.status(500).json({ error: 'Errore nel salvataggio' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Elimina codifica
router.delete('/delete/:codice', authMiddleware, (req: Request, res: Response) => {
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
    } else {
      res.status(500).json({ error: 'Errore nel salvataggio' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
