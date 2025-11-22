# 📦 Guida Completa: Configurazione Database Persistente sul NAS

## 🎯 Problema Risolto

L'errore `⚠️ Database file not found` accadeva perché:

1. **Volumi Docker isolati** - i dati venivano salvati solo nel container, persi al riavvio
2. **Nessun mount del NAS** - non c'era connessione tra il container e il filesystem del NAS
3. **Percorsi non persistenti** - database e backup non venivano salvati in directory permanenti

## ✅ Soluzione Implementata

### 1. **Docker Compose Aggiornato**
   - Mount bind dalla directory persistente del NAS (`/mnt/molino/data`) al container (`/data/molino`)
   - NAS Backup Server separato che condivide lo stesso mount
   - Entrambi i servizi leggono/scrivono dal **stesso percorso persistente**

### 2. **Script di Setup Automatico**
   - `setup-nas-mount.sh` configura il mount SMB/NFS in `/etc/fstab`
   - Mount è automaticamente ristabilito dopo il reboot
   - Supporta sia SMB (Windows/NAS) che NFS

### 3. **Variabili d'Ambiente Corrette**
   - `.env.docker` aggiornato con percorsi persistenti
   - Database: `/data/molino/tasks.db`
   - Backups: `/data/molino/backups/`

---

## 🚀 Istruzioni di Setup

### **STEP 1: Configura il Mount NAS sul Linux Host**

Sul NAS (o host Linux dove è installato Docker):

```bash
# Scarica e esegui lo script di setup
sudo bash setup-nas-mount.sh

# Rispondi alle domande interattive:
# - IP del NAS: es. 192.168.1.100
# - Path della share: es. /molino (o /backups)
# - Tipo: smb o nfs
# - Credenziali (se SMB)
```

Lo script:
- ✅ Installa le dipendenze (`cifs-utils` per SMB)
- ✅ Configura il mount in `/etc/fstab`
- ✅ Crea le directory `/mnt/molino/data/molino/backups`
- ✅ Testa il mount automaticamente

**Output di successo:**
```
✅ Setup completato!
✅ Mount eseguito con successo!
📂 Dati persistenti verranno salvati in: /mnt/molino/data/molino
```

### **STEP 2: Verifica il Mount**

```bash
# Controlla che il mount sia attivo
mount | grep molino
df -h /mnt/molino

# Output atteso:
# //192.168.1.100/molino on /mnt/molino type cifs (rw,...)
# //192.168.1.100/molino  100G   50G   50G  50% /mnt/molino
```

### **STEP 3: Avvia i Container Docker**

```bash
cd task-manager-app

# Ferma eventuali container vecchi
docker-compose down

# Ricostruisci e avvia (con il nuovo docker-compose.yml)
docker-compose up -d --build

# Verifica i log
docker-compose logs -f molino-app

# Output atteso:
# 🗄️ Initializing database schema...
# ✅ Database connected successfully
# 📊 Database initialized with 5 users
# ✅ Server is running on port 5000
```

### **STEP 4: Verifica i Dati Persistenti**

```bash
# Dentro il container
docker-compose exec molino-app ls -la /data/molino/

# Output atteso:
# total X
# drwxr-xr-x  3 root root  4096 Nov 22 12:00 .
# drwxr-xr-x  3 root root  4096 Nov 22 12:00 ..
# drwxr-xr-x  2 root root  4096 Nov 22 12:00 backups
# -rw-r--r--  1 root root 65536 Nov 22 12:01 tasks.db
```

---

## 📂 Struttura dei Dati

```
/mnt/molino/data/molino/              ← Mount NAS (persistente)
├── tasks.db                          ← Database SQLite
└── backups/
    ├── db-backup-2025-11-22T12-00-00-000Z.sql
    ├── db-backup-2025-11-22T13-00-00-000Z.sql
    └── db-backup-2025-11-22T14-00-00-000Z.sql
```

---

## 🔄 Come Funziona

### **Flusso di Backup:**

```
1. Container molino-app scrive in /data/molino/tasks.db
2. /data/molino è un bind mount verso /mnt/molino/data/molino (NAS)
3. Ogni ora, il BackupService copia tasks.db → backups/db-backup-XXX.sql
4. NAS Backup Server riceve il backup via HTTP
5. Backup viene salvato in /data/molino/backups/ (NAS)
6. Dati rimangono persistenti anche se il container si ferma
```

### **Flusso di Ripristino:**

```
1. Container si avvia e carica /data/molino/tasks.db
2. Se il database esiste, lo usa normalmente
3. Se manca, restituisce il backup più recente dal NAS
4. Database è sempre coerente
```

---

## 🛠️ Troubleshooting

### **Problema: "Cannot mount to /mnt/molino"**

```bash
# Causa: Directory non esiste o non ha permessi
sudo mkdir -p /mnt/molino
sudo chmod 755 /mnt/molino

# Riprova lo script
sudo bash setup-nas-mount.sh
```

### **Problema: "Mount permission denied"**

```bash
# Causa: Credenziali SMB errate
# Soluzione:
sudo nano /root/.molino-nas-creds
# Verifica username e password

# Oppure rimonta:
sudo umount /mnt/molino
sudo mount -a
```

### **Problema: "Database file not found" persiste**

```bash
# Verifica che il mount sia corretto nel container
docker-compose exec molino-app mount | grep molino

# Verifica i permessi
ls -la /mnt/molino/data/molino/
sudo chmod -R 755 /mnt/molino/data/molino/

# Ricrea il container
docker-compose down
docker-compose up -d --build
```

### **Problema: Docker non vede i dati del NAS**

```bash
# Il bind mount potrebbe non essere propagato
# Soluzione: Aggiungi flag di propagazione nel docker-compose.yml

volumes:
  - /mnt/molino/data:/data/molino:rprivate
```

---

## 📋 Checklist di Verifica

- [ ] Mount NAS configurato: `sudo bash setup-nas-mount.sh` ✅
- [ ] Mount è persistente: `mount | grep molino` ✅
- [ ] Directory esiste: `ls -la /mnt/molino/data/molino/` ✅
- [ ] Permessi corretti: `755` o superiore ✅
- [ ] Docker-compose aggiornato con nuovi percorsi ✅
- [ ] Container avviato: `docker-compose up -d` ✅
- [ ] Database creato: `ls -la /mnt/molino/data/molino/tasks.db` ✅
- [ ] Backup funziona: `curl http://localhost:5000/api/backup/status` ✅

---

## 🔐 Sicurezza

### **Best Practices:**

1. **Credenziali SMB:**
   - File `/root/.molino-nas-creds` ha permessi `600` (solo root)
   - Non committare credenziali in git

2. **Backup:**
   - Verifica che i backup siano salvati sul NAS
   - Testa periodicamente il ripristino: `curl -X POST http://localhost:5000/api/backup/restore-latest`

3. **NAS Backup Server:**
   - Limita l'accesso sulla porta `5001` alla rete interna
   - Usa un firewall per proteggere la porta

---

## 📚 Comandi Utili

```bash
# Verifica status backup
curl http://localhost:5000/api/backup/status | jq

# Scarica un backup specifico
curl http://localhost:5000/api/backup/download/db-backup-2025-11-22T12-00-00-000Z.sql \
  -o backup-$(date +%s).sql

# Ripristina l'ultimo backup
curl -X POST http://localhost:5000/api/backup/restore-latest

# Vedi i log del container
docker-compose logs -f molino-app

# Accedi al container
docker-compose exec molino-app /bin/sh

# Verifica lo spazio su NAS
docker-compose exec molino-app df -h /data/molino
```

---

## 🎓 Concetti Chiave

### **Volumi Docker vs Bind Mount:**

| Aspetto | Docker Volume | Bind Mount |
|---------|---------------|-----------|
| Persistenza | ✅ Solo se non cancellato | ✅ Sempre (sistema file) |
| Percorso | Docker gestito | Directory esplicita |
| Performance | Buona | Ottima |
| NAS | ❌ No | ✅ Sì |
| **Usato** | **Precedente** | **Nuovo (corretto)** |

### **Flusso Dati Corretto:**

```
NAS Fisico (192.168.1.100:/molino)
         ↓ (SMB Mount)
    /mnt/molino/data (Linux Host)
         ↓ (Bind Mount Docker)
    /data/molino (Container)
         ↓ (Accesso App)
    tasks.db & backups/
```

---

## 📞 Supporto

Se hai problemi:

1. Controlla i log: `docker-compose logs -f`
2. Verifica il mount: `mount | grep molino`
3. Testa la connessione NAS: `ping 192.168.1.100`
4. Esegui lo script di setup di nuovo: `sudo bash setup-nas-mount.sh`

---

**✅ Setup completato! I tuoi dati sono ora persistenti sul NAS.**
