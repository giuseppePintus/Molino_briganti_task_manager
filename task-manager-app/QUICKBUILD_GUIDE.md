# 🚀 Script Quick Build + Deploy

Questo script automatizza completamente il deploy sul NAS con esclusione dati.

## 📋 Come Usarlo

### Opzione 1: Script PowerShell (CONSIGLIATO)
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app
.\quickbuild-nas.ps1
```

**Cosa Fa:**
1. Compila TypeScript ✅
2. Crea archivio escludendo dati ✅
3. Verifica che non ci siano dati ✅
4. Upload al NAS ✅
5. Extract e restart container ✅
6. Mostra status finale ✅

### Opzione 2: One-Liner Command
Se preferisci il comando manuale:
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app; npm run build; tar -czf task-manager-update.tar.gz --exclude='*.db' --exclude='*.db-journal' --exclude='server/prisma/dev.db' --exclude='server/prisma/prod.db' --exclude='molino-data/*' public server/dist server/prisma package.json; scp task-manager-update.tar.gz vsc@192.168.1.248:/share/Container/; ssh vsc@192.168.1.248 "cd /share/Container && tar -xzf task-manager-update.tar.gz && /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-app"
```

---

## ⚙️ Requisiti

- PowerShell (Windows)
- npm (Node.js)
- tar (incluso in Windows 10+, altrimenti via Git Bash)
- ssh/scp (OpenSSH - incluso in Windows 10+ oppure via Git Bash)
- SSH key configurato O password vsc (viene chiesta)

---

## 🔍 Verifica Manuale Archivio

Se vuoi controllare cosa c'è dentro prima di uploadare:
```powershell
tar -tzf task-manager-update.tar.gz | Select-String -Pattern '\.db|molino-data'

# Deve uscire VUOTO (nessun file di dati)
# Se ci sono file → annulla il deploy!
```

---

## ❌ Cosa NON Fare

❌ `tar -czf task-manager-update.tar.gz public server/dist server/prisma package.json`
   → Questo include i dati! ⚠️

✅ `tar -czf task-manager-update.tar.gz --exclude='*.db' --exclude='*.db-journal' ...`
   → Questo esclude i dati! ✅

---

## 📊 Output Atteso

```
🚀 Quick Build + Deploy NAS (senza dati)
=========================================

📦 Step 1/5: Compilazione TypeScript...
✅ TypeScript compilato

📦 Step 2/5: Creazione archivio (esclude dati)...
✅ Archivio creato (7205KB)

🔍 Step 3/5: Verifica archivio...
✅ Archivio verificato (nessun dato incluso)

📤 Step 4/5: Upload al NAS...
✅ File caricato

🔧 Step 5/5: Extract e restart container...
✅ Container riavviato

✅ DEPLOY COMPLETATO!
   URL: http://192.168.1.248:5000
```

---

## 🐛 Troubleshooting

### Errore: "SSH Connection Refused"
```bash
# Assicurati che il NAS sia online
ping 192.168.1.248
```

### Errore: "tar not found"
```bash
# Installa Git Bash che include tar, ssh, scp
# O usa WSL2 per avere linux tools nativi
```

### Errore: "Archivio contiene file di dati"
1. Il comando non ha `--exclude` corretto
2. Cancella l'archivio
3. Usa lo script PowerShell che lo fa automaticamente

### Errore: "Permission Denied" (SSH)
```bash
# Controlla che la SSH key sia nella cartella corretta
ls ~/.ssh/
# Oppure usa password quando richiesto
```

---

## 💡 Tips

- **Esegui lo script prima di andare via**: Ci vuole max 1 minuto
- **Controlla l'URL dopo**: http://192.168.1.248:5000
- **I dati restano sempre salvati**: Il deploy non tocca mai il database
- **Se qualcosa va male**: Il container rimane online, puoi riprovare

---

## 📝 Changelog

| Data | Versione | Cosa |
|------|----------|------|
| 2025-12-14 | 1.0 | Script creato con esclusione dati automatica |
| 2025-12-14 | 1.0 | Verifica archivio integrata |

---

**Creato il**: 2025-12-14  
**Per**: Molino Briganti Task Manager  
**Status**: Production Ready ✅
