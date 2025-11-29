# 🔍 DIAGNOSTICA RAPIDA - Esegui Questi Comandi

Copia e incolla i seguenti comandi dal tuo PC per capire il problema:

## COMANDO 1: Scopri l'architettura del NAS
```powershell
ssh root@<NAS_IP> "uname -m"
```
**Possibili risultati:**
- `x86_64` = Intel/AMD 64-bit ✅ (compatibile)
- `aarch64` = ARM 64-bit ⚠️ (potrebbero servire immagine arm64)
- `armv7l` = ARM 32-bit ⚠️ (serve immagine arm32)
- `armv6l` = ARM 32-bit ⚠️ (serve immagine arm32)

---

## COMANDO 2: Scopri versione Docker
```powershell
ssh root@<NAS_IP> "docker --version"
```
**Atteso:** Docker version 20.10.x o superiore

---

## COMANDO 3: Vedi l'errore esatto del pull
```powershell
ssh root@<NAS_IP> "docker pull molino-task-manager:latest 2>&1"
```
**Copia-incolla l'errore completo qui** → `[ERRORE]`

---

## COMANDO 4: Verifica connettività Internet del NAS
```powershell
ssh root@<NAS_IP> "ping -c 1 8.8.8.8"
```
**Se fallisce:** Il NAS non ha internet

---

## COMANDO 5: Verifica connessione a Docker Hub
```powershell
ssh root@<NAS_IP> "curl -I https://registry-1.docker.io/v2/"
```
**Se fallisce:** Firewall o DNS problema

---

## COMANDO 6: Immagini Docker sul NAS
```powershell
ssh root@<NAS_IP> "docker images | grep molino"
```
**Mostra:** Quali immagini molino sono già nel NAS

---

## COMANDO 7: Spazio disco disponibile
```powershell
ssh root@<NAS_IP> "df -h /"
```
**Assicurati:** Almeno 2-3 GB liberi per la build

---

## 🎯 COSA FARE DOPO AVER ESEGUITO I COMANDI

### Se architettura = x86_64
✅ **Nessun problema di compatibilità**
- Se il pull fallisce: è problema di connettività/permessi
- Soluzione: Usa il build locale
  ```powershell
  .\deploy-nas-with-build.ps1 -NasIp <NAS_IP>
  ```

### Se architettura = aarch64 (ARM64)
⚠️ **Possibile incompatibilità**
- L'immagine che abbiamo è solo amd64
- Il NAS è ARM64
- **Soluzione:**
  ```powershell
  # Costruisci immagine che supporta sia amd64 che aarch64
  .\build-multiarch.ps1
  
  # Oppure build locale (raccomandiato se non hai Docker Registry)
  .\deploy-nas-with-build.ps1 -NasIp <NAS_IP>
  ```

### Se architettura = armv7l o armv6l (ARM32)
⚠️ **Incompatibilità sicura**
- L'immagine non supporta ARM 32-bit
- **Soluzione:**
  ```powershell
  # Build locale (il NAS buildare per se stesso)
  .\deploy-nas-with-build.ps1 -NasIp <NAS_IP>
  
  # Questo richiederà 15-20 minuti sul NAS ma funzionerà
  ```

---

## ⚡ QUICK FIX IMMEDIATO

Se vuoi risolvere **SUBITO** senza diagnosticare:

```powershell
cd c:\Users\manue\Molino_briganti_task_manager\task-manager-app

# Questo funzionerà con QUALSIASI architettura NAS
.\deploy-nas-with-build.ps1 -NasIp 192.168.1.100 -NasUser root
```

**Tempi:**
- x86_64: 10-15 minuti (build + avvio)
- ARM64: 15-20 minuti (build + avvio)
- ARM32: 20-30 minuti (build + avvio)

---

## 📞 Mostrami

Per aiutarti velocemente, forniscimi:

1. Output di: `ssh root@<NAS_IP> "uname -m"`
2. Output di: `ssh root@<NAS_IP> "docker --version"`
3. Output di: `ssh root@<NAS_IP> "docker pull molino-task-manager:latest 2>&1"`

Così posso dirti esattamente cosa fare.
