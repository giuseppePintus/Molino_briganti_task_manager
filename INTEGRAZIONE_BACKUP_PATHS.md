# 🔧 INTEGRAZIONE COMPLETA: PERCORSI BACKUP PERSONALIZZATI

## ✅ COSA È STATO FATTO

### 1. **Frontend** (backup-management.html)
- ✅ Aggiunta sezione "Percorsi Backup" con 3 campi input
- ✅ Pulsante "Salva" per ogni percorso
- ✅ Visualizzazione percorsi attuali configurati
- ✅ Funzione `saveBackupPath(pathType)` che chiama l'API
- ✅ Fallback su localStorage se API non disponibile
- ✅ Caricamento automatico dei percorsi salvati

### 2. **Backend Routes** (server/src/routes/backup.ts)
- ✅ Endpoint `POST /api/backup/settings/path` - Salva i percorsi
- ✅ Endpoint `GET /api/backup/settings/paths` - Recupera i percorsi

---

## 📝 STEP-BY-STEP PER COMPLETARE L'INTEGRAZIONE

### **STEP 1: Aggiornare il file `.env` del server**

Aggiungi nel file `task-manager-app/server/.env`:

```env
# Backup Paths Configuration
BACKUP_DIR_LOCAL=./backups
BACKUP_DIR_NAS=
BACKUP_DIR_CLOUD=
```

**File:** `task-manager-app/server/.env`

---

### **STEP 2: Creare file di configurazione persistente**

Crea il file `task-manager-app/server/src/config/backupConfig.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_FILE = path.join(__dirname, '../../backup-config.json');

export interface BackupConfig {
  local: string;
  nas: string;
  cloud: string;
}

export class BackupConfigService {
  private static defaultConfig: BackupConfig = {
    local: process.env.BACKUP_DIR_LOCAL || './backups',
    nas: process.env.BACKUP_DIR_NAS || '',
    cloud: process.env.BACKUP_DIR_CLOUD || ''
  };

  static loadConfig(): BackupConfig {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Errore caricamento config, usando defaults:', error);
    }
    return this.defaultConfig;
  }

  static saveConfig(config: BackupConfig): void {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Errore salvataggio config:', error);
      throw error;
    }
  }

  static updatePath(pathType: 'local' | 'nas' | 'cloud', newPath: string): BackupConfig {
    const config = this.loadConfig();
    config[pathType] = newPath;
    this.saveConfig(config);
    return config;
  }
}
```

---

### **STEP 3: Aggiornare le routes del backup**

Modifica il file `task-manager-app/server/src/routes/backup.ts` e aggiorna gli endpoint:

```typescript
import { BackupConfigService } from '../config/backupConfig';

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

    // Salva nel file di configurazione
    const updatedConfig = BackupConfigService.updatePath(pathType, backupPath);

    res.json({
      success: true,
      message: `${pathType} backup path updated successfully`,
      config: updatedConfig,
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
    const config = BackupConfigService.loadConfig();
    res.json({
      success: true,
      paths: config,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

---

### **STEP 4: Aggiornare il BackupService**

Modifica il file `task-manager-app/server/src/services/backupService.ts` per usare i percorsi configurati:

```typescript
import { BackupConfigService } from '../config/backupConfig';

// Nella classe BackupService, aggiorna i metodi per usare:
private static getBackupDir(): string {
  const config = BackupConfigService.loadConfig();
  return config.local || './backups';
}

// Usa getBackupDir() invece di './backups' in tutti i metodi
```

---

### **STEP 5: Aggiornare il frontend per caricare i percorsi dal backend**

Nel file `backup-management.html`, aggiungi nel caricamento:

```javascript
async function loadBackupPathsFromServer() {
  try {
    const response = await fetch(`${API_URL}/backup/settings/paths`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const result = await response.json();
      const paths = result.paths;
      
      document.getElementById('localBackupPath').value = paths.local || './backups';
      document.getElementById('nasBackupPath').value = paths.nas || '';
      document.getElementById('cloudBackupPath').value = paths.cloud || '';
      
      updateBackupPathDisplay();
      return;
    }
  } catch (error) {
    console.warn('Errore caricamento percorsi dal server:', error);
  }
  
  // Fallback: carica da localStorage
  loadBackupPaths();
}

// Chiama nel window.addEventListener('load')
window.addEventListener('load', () => {
  loadBackups();
  loadBackupPathsFromServer(); // NUOVO
  
  // ... resto del codice
});
```

---

## 📋 CHECKLIST COMPLETAMENTO

- [ ] Aggiornare `.env` con `BACKUP_DIR_LOCAL`, `BACKUP_DIR_NAS`, `BACKUP_DIR_CLOUD`
- [ ] Creare file `server/src/config/backupConfig.ts`
- [ ] Aggiornare `server/src/routes/backup.ts` con i nuovi endpoint
- [ ] Aggiornare `server/src/services/backupService.ts` per usare `BackupConfigService`
- [ ] Aggiornare `backup-management.html` per caricare i percorsi dal server
- [ ] Testare il salvataggio e caricamento dei percorsi
- [ ] Compilare TypeScript: `npm run build` nella cartella server
- [ ] Riavviare il server

---

## 🧪 COME TESTARE

1. **Apri** `http://localhost:5000/backup-management.html`
2. **Vai a** sezione "Percorsi Backup"
3. **Inserisci** un percorso locale: `/data/backups` (o simile)
4. **Clicca** "💾 Salva"
5. **Verifica** che appaia un messaggio di successo
6. **Ricarica** la pagina (Ctrl+Shift+R)
7. **Conferma** che il percorso sia rimasto salvato

---

## 📊 STRUTTURA FILE FINALE

```
server/
├── src/
│   ├── config/
│   │   └── backupConfig.ts ← NUOVO FILE
│   ├── routes/
│   │   └── backup.ts ← AGGIORNATO
│   ├── services/
│   │   └── backupService.ts ← DA AGGIORNARE
│   └── index.ts
├── .env ← DA AGGIORNARE
└── backup-config.json ← CREATO AUTOMATICAMENTE

public/
└── backup-management.html ← AGGIORNATO
```

---

## 💡 NOTE IMPORTANTI

1. **Persistenza**: I percorsi vengono salvati in `backup-config.json` nel server
2. **Fallback**: Se il backend non risponde, frontend usa localStorage
3. **Sicurezza**: Aggiungi validazione dei percorsi nel backend (path traversal prevention)
4. **Autorizzazione**: Assicurati che solo master possa modificare i percorsi

---

## 🚀 PROSSIMI STEP (OPZIONALI)

- [ ] Validare i percorsi (verificare che siano accessibili)
- [ ] Testare la connessione al NAS
- [ ] Implementare backup automatico su più percorsi
- [ ] Aggiungere UI per testare la connessione ai percorsi
- [ ] Logging delle operazioni di backup

---

## ❓ DOMANDE?

Se hai domande durante l'implementazione, controlla:
1. Console del browser (F12) per errori frontend
2. Log del server per errori backend
3. File `backup-config.json` per verificare le configurazioni salvate
