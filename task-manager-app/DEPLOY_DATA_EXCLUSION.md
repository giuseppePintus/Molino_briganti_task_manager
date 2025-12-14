# 📌 Esclusione Dati nei Deploy - IMPORTANTE!

**Data**: Dec 14, 2025  
**Status**: ⚠️ **CRITICO - Leggere prima di ogni deploy**

---

## ⚠️ Problema

Quando facciamo il build/quickbuild, dobbiamo **escludere i file di dati** per evitare di sovrascrivere i dati di produzione (ordini, viaggi, task, etc).

---

## ✅ Soluzione: Comandi Aggiornati

### One-Liner Corretto (ESCLUDE DATI)
```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app; npm run build; tar -czf task-manager-update.tar.gz --exclude='*.db' --exclude='*.db-journal' --exclude='server/prisma/dev.db' --exclude='server/prisma/prod.db' --exclude='molino-data/*' public server/dist server/prisma package.json; scp task-manager-update.tar.gz vsc@192.168.1.248:/share/Container/; ssh vsc@192.168.1.248 "cd /share/Container && tar -xzf task-manager-update.tar.gz && /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-app"; Write-Host "`n✅ DEPLOY COMPLETATO (senza dati)!" -ForegroundColor Green
```

### Cosa Viene Escl usando
| File/Cartella | Motivo | 
|---|---|
| `*.db` | Database SQLite ordini/viaggi/task |
| `*.db-journal` | Journal del database |
| `server/prisma/dev.db` | DB di sviluppo locale |
| `server/prisma/prod.db` | DB di produzione |
| `molino-data/*` | Cartelle dati molino (backup, etc) |

---

## 🔍 Verifica Archivio PRIMA di Uploadare

```powershell
# Controlla se ci sono dati nell'archivio
tar -tzf task-manager-update.tar.gz | Select-String -Pattern '\.db|molino-data'

# Se NON esce nulla = OK ✅
# Se escono file .db = ERRORE ❌ - Non fare deploy!
```

---

## 📋 Checklist Pre-Deploy

- [ ] Ho usato il comando corretto con `--exclude`?
- [ ] Ho verificato l'archivio con `tar -tzf`?
- [ ] Non contiene file `.db` o `molino-data`?
- [ ] OK? Procedi con deploy

---

## 🚀 Prossimi Passi

1. **Salvare questo file come bookmark mentale**
2. **Usare SEMPRE il comando corretto** (vedi sezione "One-Liner Corretto")
3. **Verificare SEMPRE l'archivio** prima di upload

---

## 📝 Note Importanti

- Il database SQLite rimane nel container `/app/server/prisma/data/`
- I dati NON vengono toccati dal deploy
- Solo il codice (public/, server/dist) viene aggiornato
- I backup continuano a funzionare normalmente
