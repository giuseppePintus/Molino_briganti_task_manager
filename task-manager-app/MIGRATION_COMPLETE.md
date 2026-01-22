# Migrazione completata: SQLite → MariaDB

## Riepilogo migrazione

✅ **Dati migrati con successo:**
- 5 Utenti
- 3 Clienti  
- 43 Articoli
- 43 Record Inventario
- 20 Impostazioni aziendali (parziale)

⚠️ **Note:**
- Tasks, Orders e Trips non sono stati migrati a causa di cambiamenti significativi nello schema
- Questi dati possono essere reinseriti manualmente se necessario
- Lo schema è stato completamente aggiornato per MariaDB

## Database configurato

**Server:** QNAP NAS (192.168.1.248)  
**Database:** MariaDB 10.5.8  
**Nome DB:** molino_production  
**Porta:** 3306  
**Utente:** molino_user  
**Password:** ***REDACTED_DB_PASSWORD***

**Connection String:**
```
mysql://molino_user:***REDACTED_DB_PASSWORD***@192.168.1.248:3306/molino_production
```

## Prossimi passi per completare il deploy

### 1. Avvia Docker Desktop

Prima di procedere con il deploy, assicurati che Docker Desktop sia in esecuzione sul tuo computer.

### 2. Esegui il deploy sul NAS

```powershell
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app
.\deploy-mariadb.ps1
```

Questo script:
- Compila l'immagine Docker
- Ferma il container esistente sul NAS
- Trasferisce la nuova immagine
- Avvia il container con MariaDB configurato

### 3. Verifica il deployment

1. Apri il browser: http://192.168.1.248:5000
2. Verifica login e dati
3. Controlla logs:
   ```bash
   ssh admin@192.168.1.248
   docker logs -f molino-briganti-task-manager
   ```

### 4. Configura backup automatici MariaDB

Il file `mariadb-backup.sh` è già pronto. Configuralo sul NAS:

#### A. Trasferisci lo script sul NAS

```powershell
scp mariadb-backup.sh admin@192.168.1.248:/share/Public/molino-data/
```

#### B. Rendilo eseguibile

```bash
ssh admin@192.168.1.248
chmod +x /share/Public/molino-data/mariadb-backup.sh
```

#### C. Configura cron job per backup ogni ora

```bash
# Accedi al NAS
ssh admin@192.168.1.248

# Modifica crontab
crontab -e

# Aggiungi questa riga per backup ogni ora
0 * * * * /share/Public/molino-data/mariadb-backup.sh >> /share/Public/molino-data/backups/mariadb/backup.log 2>&1

# Salva ed esci (:wq)
```

#### D. Test manuale del backup

```bash
ssh admin@192.168.1.248
/share/Public/molino-data/mariadb-backup.sh
```

Verifica che sia stato creato il file in `/share/Public/molino-data/backups/mariadb/`

### 5. Verifica backup periodici

Dopo qualche ora, controlla che i backup vengano eseguiti:

```bash
ssh admin@192.168.1.248
ls -lh /share/Public/molino-data/backups/mariadb/
tail -50 /share/Public/molino-data/backups/mariadb/backup.log
```

## Script di restore da backup

Per ripristinare un backup MariaDB:

```bash
# Su NAS
gunzip < /share/Public/molino-data/backups/mariadb/mariadb-backup-YYYY-MM-DD_HH-MM-SS.sql.gz | \
  /usr/local/mariadb/bin/mysql \
  -h 127.0.0.1 \
  -P 3306 \
  -u molino_user \
  -p***REDACTED_DB_PASSWORD*** \
  molino_production
```

## Files modificati durante la migrazione

### Schema database
- `server/prisma/schema.prisma` - Provider cambiato da sqlite a mysql

### Configurazione
- `.env` - DATABASE_URL aggiornato per MariaDB
- `server/src/services/databaseInit.ts` - Rimossi comandi PRAGMA specifici di SQLite

### Servizi
- `server/src/services/inventoryService.ts` - Campo `position` rinominato in `shelfPosition`

### Script migrazione
- `export-sqlite-data.js` - Export dati da SQLite
- `import-to-mariadb-simple.js` - Import semplificato in MariaDB
- `sqlite-migration-export.json` - Dati esportati (130 record)

### Script deployment
- `deploy-mariadb.ps1` - Deploy automatico su NAS con MariaDB
- `mariadb-backup.sh` - Backup automatico MariaDB

## Vantaggi della nuova architettura

✅ **Database centralizzato** - Un unico database accessibile da più applicazioni  
✅ **Backup robusti** - mysqldump nativo di MariaDB, affidabile e testato  
✅ **Performance migliorate** - MariaDB gestisce meglio la concorrenza  
✅ **Scalabilità** - Possibilità di replicazione e clustering futuro  
✅ **Interoperabilità** - Accesso diretto via SQL da altri tool/script  

## Troubleshooting

### Container non si avvia
```bash
ssh admin@192.168.1.248
docker logs molino-briganti-task-manager
```

### Problemi di connessione database
```bash
ssh admin@192.168.1.248
/usr/local/mariadb/bin/mysql -h 127.0.0.1 -P 3306 -u molino_user -p***REDACTED_DB_PASSWORD*** molino_production -e "SHOW TABLES;"
```

### Backup non funziona
```bash
# Test manuale
ssh admin@192.168.1.248
/share/Public/molino-data/mariadb-backup.sh

# Verifica crontab
crontab -l
```

## Contatti e supporto

Per problemi o domande sulla migrazione, verifica:
1. Logs del container Docker
2. Logs di MariaDB in `/var/log/mariadb/`
3. Connettività di rete al NAS (ping 192.168.1.248)
