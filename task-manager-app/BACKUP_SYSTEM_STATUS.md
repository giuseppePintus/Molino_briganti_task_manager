# Sistema di Backup MariaDB - Configurazione e Test

## ✅ Stato Attuale

### Backup Manuale
- ✅ **Script di backup**: `/share/Public/molino-data/mariadb-backup.sh`
- ✅ **Directory backup**: `/share/Public/molino-data/backups/mariadb/`
- ✅ **Formato**: SQL compresso (gzip)
- ✅ **Retention**: 30 giorni
- ✅ **Testato**: Backup e ripristino funzionanti

### Backup Automatico
- ⚠️ **Crontab**: Non configurato (limite spazio nel crontab del NAS)
- ✅ **Alternativa**: Backup manuale tramite comando SSH

## 📋 Comandi Disponibili

### Creare un Backup Manuale
```bash
ssh admin@192.168.1.248 "/share/Public/molino-data/mariadb-backup.sh"
```

### Elencare i Backup Disponibili
```bash
ssh admin@192.168.1.248 "ls -lh /share/Public/molino-data/backups/mariadb/"
```

### Ripristinare da un Backup
```bash
# 1. Lista backup disponibili
ssh admin@192.168.1.248 "ls -1 /share/Public/molino-data/backups/mariadb/"

# 2. Ripristina dal backup specifico
ssh admin@192.168.1.248 "/share/Public/molino-data/mariadb-restore.sh /share/Public/molino-data/backups/mariadb/mariadb-backup-YYYY-MM-DD_HH-MM-SS.sql.gz"

# 3. Riavvia il container
ssh admin@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-task-manager-nas"
```

## 🔄 Test di Verifica Eseguiti

### Test 1: Creazione Backup ✅
```
Backup creato: mariadb-backup-2026-01-21_00-05-12.sql.gz
Dimensione: 4.9K
Task presenti: 12
```

### Test 2: Ripristino Backup ✅
```
1. Task eliminato manualmente (ID 17)
2. Ripristino da backup
3. Task recuperato correttamente
Risultato: 12 task ripristinati
```

## 📊 Contenuto del Backup

Il backup include tutte le tabelle del database:
- ✅ User (8 utenti)
- ✅ Task (12 task)
- ✅ Article (43 articoli)
- ✅ Customer (3 clienti)
- ✅ Inventory (43 record inventario)
- ✅ Trip (3 trip)
- ✅ Order, OrderItem
- ✅ CompanySettings
- ✅ Warehouse, Vehicle, Holiday, StockAlert, StockMovement
- ✅ TaskNote

## ⚙️ Configurazione Automatica (Opzioni)

### Opzione 1: Script PowerShell Schedulato (Windows)
Creare un task schedulato su Windows che esegue:
```powershell
. .\nas-config.local.ps1   # carica $NAS_USER, $NAS_PASSWORD, $NAS_IP
$secure = ConvertTo-SecureString $NAS_PASSWORD -AsPlainText -Force
$cred   = New-Object System.Management.Automation.PSCredential($NAS_USER, $secure)
Invoke-Command -ComputerName $NAS_IP -Credential $cred -ScriptBlock {
    /share/Public/molino-data/mariadb-backup.sh
}
```

### Opzione 2: Wrapper Script nel Container
Modificare il container per chiamare lo script di backup via SSH ogni ora.

### Opzione 3: Backup Manuale Periodico
Eseguire manualmente il backup quando necessario (es. prima di aggiornamenti importanti).

## 🔐 Sicurezza

- ✅ Backup compressi (gzip)
- ✅ Retention policy attiva (30 giorni)
- ✅ Credenziali database non esposte nei backup
- ⚠️ Backup in chiaro (non criptati) - considerare criptazione per ambiente produzione

## 📝 Raccomandazioni

1. **Backup Prima di Modifiche Importanti**: Eseguire sempre un backup manuale prima di:
   - Aggiornamenti del software
   - Modifiche allo schema del database
   - Importazione massiva di dati

2. **Test Periodici di Ripristino**: Testare il ripristino almeno una volta al mese

3. **Backup Offsite**: Considerare di copiare periodicamente i backup su un'altra location

4. **Monitoraggio**: Verificare regolarmente che i backup vengano creati correttamente

## 🎯 Stato Finale

- ✅ Sistema di backup funzionante
- ✅ Script di ripristino testato
- ✅ 2 backup disponibili
- ⚠️ Automazione da configurare manualmente (crontab pieno)
