# 📋 GUIDA: Carica molino-image.tar nel QNAP MANUALMENTE

## File Pronto
- **Nome**: `molino-image.tar`
- **Dimensione**: 482 MB
- **Percorso**: `C:\Users\manue\Molino_briganti_task_manager\task-manager-app\molino-image.tar`

---

## Metodo 1: Via File Manager Windows (PIÙ SEMPLICE)

### Step 1: Apri Esplora File
```powershell
# Nel tuo PC, premi Win + E oppure esegui:
explorer \\192.168.1.248\share
```

### Step 2: Login QNAP (se richiesto)
- **Utente**: admin
- **Password**: [inserisci la password QNAP]

### Step 3: Trascina il File
1. Apri una finestra separata di **Esplora File**
2. Naviga a: `C:\Users\manue\Molino_briganti_task_manager\task-manager-app\`
3. Trascina il file `molino-image.tar` nella finestra del QNAP
4. Aspetta che finisca il trasferimento (5-10 minuti)

### Step 4: Verifica
Nel QNAP, dovresti vedere il file nella cartella `/share`

---

## Metodo 2: Via PowerShell (Se conosci la password admin)

```powershell
# Modifica la password
$qnapPassword = "TUA_PASSWORD_ADMIN"

# Esegui questo comando
cd C:\Users\manue\Molino_briganti_task_manager\task-manager-app

# Connetti al QNAP
net use Z: \\192.168.1.248\share /user:admin "$qnapPassword"

# Copia il file (questo richiederà 5-10 minuti)
Copy-Item molino-image.tar Z:\molino-image.tar -Force -Verbose

# Verifica
Get-ChildItem Z:\molino-image.tar

# Disconnetti
net use Z: /delete
```

---

## Metodo 3: Via File Manager QNAP (Web UI)

1. Apri browser: `http://192.168.1.248:8080` (oppure 9000, dipende dal QNAP)
2. Login con admin / password
3. Apri **File Station**
4. Clicca **Upload** e seleziona il file `molino-image.tar`
5. Aspetta che finisca

---

## ⏭️ Una volta caricato il file nel QNAP

1. Nel QNAP, apri **Container Station** (o **Docker**)
2. Vai a: **Images** → **Load Image**
3. Seleziona il percorso: `/share/molino-image.tar`
4. Clicca **Load**
5. Aspetta 2-3 minuti

Quando finisce, nella lista **Images** dovresti vedere:
```
molino-task-manager:latest
```

---

## ❓ Se hai problemi

### "Access Denied" quando provi a connettere via SMB
- Controlla che il nome utente admin sia corretto
- Prova con la password (potrebbe essere diversa)
- Usa il Metodo 1 (File Manager visuale) che è più semplice

### "File non si copia" o "Connessione lenta"
- Normale: il file è 482 MB
- Aspetta tranquillamente, potrebbe richiedere 10-15 minuti su connessione lenta
- Non chiudere la finestra finché non finisce

### "Load Image" non funziona nel Container Station
- Assicurati di selezionare il percorso corretto: `/share/molino-image.tar`
- Se è in una sottocartella, usa il percorso completo

---

## 🎯 RIASSUNTO RAPIDO

1. ✅ File TAR creato: 482 MB
2. ➡️ **Copia nel QNAP** (via File Manager o SMB)
3. ➡️ Nel QNAP: **Container Station → Load Image → molino-image.tar**
4. ✅ Aspetta che finisca
5. ✅ Crea container dalla nuova immagine

**Quale metodo preferisci?**
- A) File Manager Windows (grafico, semplice)
- B) PowerShell (automatico, richiede password)
- C) Web UI QNAP (direttamente nel NAS)

Fammi sapere se hai bisogno di aiuto!
