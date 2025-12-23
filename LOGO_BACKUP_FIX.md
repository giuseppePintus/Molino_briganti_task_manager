# 🔧 Fix: Logo Aziendale nel Backup e Restore

## 📋 Problema Identificato

Il logo aziendale caricato da **Company Settings** non veniva salvato nel backup. Quando si ripristinava un backup:
- Il database veniva ripristinato correttamente
- **Ma il logo aziendale scompariva** in Operator Lite
- In Operator Lite appariva il logo di default

### Cause

1. **BackupService**: Il servizio di backup includeva solo il file del database SQLite, non i file nella cartella `/data/molino/uploads` (dove vengono salvati i logo)
2. **Operator Lite**: Non aveva un fallback per caricare il logo da localStorage se l'API non era disponibile

## ✅ Soluzione Implementata

### 1. Aggiornamento BackupService (`server/src/services/backupService.ts`)

Modificato il metodo `backupDatabase()` per:
- **Backup del database**: Come prima (copia SQLite)
- **Nuovo**: Backup della cartella uploads in formato tar.gz
- **Upload**: Entrambi i file vengono caricati su NAS

#### Nuovi metodi aggiunti:
- `backupUploads()`: Comprime la cartella uploads con tar
- `backupUploadsManual()`: Fallback manuale con copia ricorsiva
- `restoreUploads()`: Ripristina la cartella uploads dal backup
- `restoreUploadsManual()`: Fallback manuale per il restore

#### Metodi aggiornati:
- `listBackups()`: Mostra sia db-backup che uploads-backup
- `cleanOldBackups()`: Cancella entrambi i tipi di backup
- `restoreDatabase()`: Ora accetta un secondo parametro `uploadsBackupPath`

### 2. Miglioramento Operator Lite (`public/operator-lite.html`)

Modificata la funzione `applyDefaultBranding()` per:
1. Tentare di caricare il logo da **localStorage** (fallback)
2. Se localStorage contiene companySettings, usa il logoUrl salvato
3. Se localStorage non ha nulla, usa il logo di default

```javascript
function applyDefaultBranding() {
    // Prova localStorage come fallback
    try {
        var stored = localStorage.getItem('companySettings');
        if (stored) {
            var settings = JSON.parse(stored);
            if (settings.logoUrl) {
                // ... carica logo da localStorage
                return;
            }
        }
    } catch(e) {
        console.warn('Failed to load from localStorage:', e);
    }
    
    // Fallback al logo di default
    // ...
}
```

## 🔄 Flusso Completo

### Salvataggio Logo (Company Settings)
1. Admin carica il logo via `/api/upload/logo`
2. File viene salvato in `/data/molino/uploads/logo-TIMESTAMP.ext`
3. URL salvato nel database (campo `logoUrl`)
4. Caricato in localStorage come parte di `companySettings`

### Backup Automatico
1. `backupDatabase()` copia il database SQLite
2. **Novo**: Copia la cartella `/data/molino/uploads` in un file tar.gz
3. Entrambi i file vengono:
   - Salvati localmente in `/data/molino/backups/`
   - Caricati su NAS

### Restore da Backup
1. Scarica dal NAS (o backup locale):
   - `db-backup-TIMESTAMP.sql`
   - `uploads-backup-TIMESTAMP.tar.gz`
2. Ripristina il database
3. **Novo**: Estrae la cartella uploads
4. Reconnect Prisma

### Visualizzazione in Operator Lite
1. Page load → `loadCompanySettings()`
2. Tenta di caricare da API (`/settings/company`)
3. Se API non disponibile → `applyDefaultBranding()`
4. **Novo**: Fallback da localStorage
5. Se localStorage vuoto → usa logo di default

## 📊 Struttura Backup

```
/data/molino/backups/
├── db-backup-2025-12-21T10-30-45-123Z.sql         # Database
├── uploads-backup-2025-12-21T10-30-45-123Z.tar.gz # Logo + files
├── db-backup-2025-12-21T09-15-20-456Z.sql
├── uploads-backup-2025-12-21T09-15-20-456Z.tar.gz
└── backup-config.json
```

## 🧪 Test della Soluzione

### Test 1: Backup con Logo
```bash
# Admin carica logo da Company Settings
# Sistema crea:
# ✅ db-backup-TIMESTAMP.sql
# ✅ uploads-backup-TIMESTAMP.tar.gz (contiene il logo)
```

### Test 2: Restore da Backup
```bash
# Ripristina backup più recente
# 1. Database ripristinato
# 2. ✅ Logo ripristinato in /data/molino/uploads/
# 3. Operator Lite mostra il logo
```

### Test 3: Operator Lite Fallback
```javascript
// Anche se API non disponibile:
// 1. loadCompanySettings() fallisce
// 2. applyDefaultBranding() carica da localStorage
// 3. ✅ Logo visualizzato correttamente
```

## 🚀 Deployment

Nessuna migrazione del database necessaria. I file modificati sono:

1. `/server/src/services/backupService.ts`
   - Aggiornato per includere uploads nel backup

2. `/public/operator-lite.html`
   - Aggiunto fallback localStorage

Il sistema è **backward compatible**:
- Backup vecchi (solo db) continuano a funzionare
- Backup nuovi includono sia db che uploads

## 📝 Note Importanti

1. **Tar availability**: Il codice fallback su compressione manuale se `tar` non disponibile
2. **Storage**: Gli uploads backup possono essere grandi. Controllare spazio su NAS
3. **Performance**: Il backup degli uploads avviene in parallelo al backup del database
4. **Cross-platform**: Supporta sia Linux/macOS che Windows (PowerShell tar)

## 🔍 Troubleshooting

### Logo non appare in Operator Lite
```javascript
// Check console logs:
console.log(localStorage.getItem('companySettings'));
// Deve contenere logoUrl corretto
```

### Backup degli uploads fallisce
```javascript
// Controlla i log del server:
// "tar command failed: ..." → fallback a copia manuale
// "Uploads backed up: ..." → successo
```

### Uploads non ripristinati
```javascript
// Nel ripristino:
// "Could not restore uploads: ..." → non critico, database OK
// "Uploads restored from: ..." → successo
```
