# Sistema Login Carosello Operatori

## 🎯 Descrizione

Sistema di login tramite carosello scorrevole per operatori base. Accesso diretto tramite foto e nome senza richiedere password.

## 🚀 Quick Start

### Avviare il Server

```bash
cd task-manager-app

# Configurare PATH Node.js (Windows)
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH

# Installare dipendenze (se non già fatto)
npm install

# Avviare il server
npm run dev
```

Il server sarà disponibile a: `http://localhost:5000`

### Accedere come Operatore

1. Apri `http://localhost:5000` nel browser
2. Vedrai il carosello con gli operatori disponibili
3. Clicca su un operatore per accedere istantaneamente
4. Sarai reindirizzato alla dashboard

## 📱 Carosello Operatori

### Funzionalità

- **Scorrevole**: Usa frecce ← → per navigare tra operatori
- **Indicatori**: Clicca su un pallino per saltare a un operatore
- **Foto**: Supporta URL e immagini base64
- **Login istantaneo**: Nessuna password richiesta

### Operatori di Test

Per impostazione predefinita il database contiene:
- **operatore1** (ID: 2)
- **operatore2** (ID: 3)
- **operatore3** (ID: 4)

## 🔐 Accesso Admin

### Master User

- **Username**: master
- **Password**: masterpass
- **URL**: http://localhost:5000/admin

### Aggiungere Foto agli Operatori

1. Accedi come master
2. Convertire immagine in base64:
```bash
# Windows PowerShell
$img = Get-Content -Path "C:\path\to\image.png" -Encoding Byte
$base64 = [Convert]::ToBase64String($img)
$base64Encoded = "data:image/png;base64,$base64"
```

3. Chiamare l'endpoint di aggiornamento:
```bash
curl -X PUT http://localhost:5000/api/auth/operators/2/image \
  -H "Authorization: Bearer <token_master>" \
  -H "Content-Type: application/json" \
  -d '{
    "operatorId": 2,
    "image": "data:image/png;base64,iVBORw0KGgo..."
  }'
```

## 📚 API Endpoints

### Public Endpoints

#### GET `/api/auth/operators/public`
Recupera lista operatori disponibili

```bash
curl http://localhost:5000/api/auth/operators/public
```

Risposta:
```json
[
  {
    "id": 2,
    "username": "operatore1",
    "image": null
  },
  {
    "id": 3,
    "username": "operatore2",
    "image": "data:image/png;base64,..."
  }
]
```

#### POST `/api/auth/quick-login`
Login operatore senza password

```bash
curl -X POST http://localhost:5000/api/auth/quick-login \
  -H "Content-Type: application/json" \
  -d '{"operatorId": 2}'
```

Risposta:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 2,
    "username": "operatore1",
    "role": "slave"
  }
}
```

### Protected Endpoints

#### PUT `/api/auth/operators/:id/image`
Aggiorna foto operatore (Admin only)

```bash
curl -X PUT http://localhost:5000/api/auth/operators/2/image \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "operatorId": 2,
    "image": "data:image/png;base64,..."
  }'
```

## 📁 Struttura Progetto

```
task-manager-app/
├── server/
│   ├── src/
│   │   ├── controllers/authController.ts
│   │   ├── routes/auth.ts
│   │   └── middleware/auth.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── dist/
├── client/
│   ├── src/
│   │   ├── pages/OperatorsCarousel.tsx
│   │   ├── styles/OperatorsCarousel.css
│   │   └── App.tsx
│   └── public/
└── docs/
    ├── OPERATORS_CAROUSEL_GUIDE.md
    ├── CAROUSEL_LOGIN_SETUP.md
    ├── COMPLETION_REPORT_CAROUSEL.md
    └── TEST_CAROUSEL.sh
```

## 🔧 Configurazione

### Variabili Ambiente (server/.env)

```
DATABASE_URL="file:./prisma/data/tasks.db"
JWT_SECRET="your_jwt_secret_key_change_this"
PORT=5000
NODE_ENV=development
DEFAULT_MASTER_USER="master"
DEFAULT_MASTER_PASS="masterpass"
```

## 🧪 Test

### Test Rapido API

```bash
# Test tutti gli endpoint
bash TEST_CAROUSEL.sh
```

### Test Manuale UI

1. Avvia server: `npm run dev`
2. Apri http://localhost:5000
3. Clicca su operatore → Verifica login
4. Apri DevTools (F12) → Console
5. Verifica localStorage:
   ```javascript
   // In console browser
   console.log(localStorage.getItem('token'))
   console.log(localStorage.getItem('operatorName'))
   ```

## 🐛 Troubleshooting

### "Operatori non caricati"
- Verificare che il server sia avviato
- Controllare che gli operatori siano nel database:
```bash
# Eseguire seed
cd server
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
npx ts-node prisma/seed.ts
```

### "Errore durante login"
- Verifica che l'operatore esista nel DB
- Controlla i log del server
- Assicurati che il token JWT sia valido

### "Immagini non visualizzate"
- Verifica che l'immagine sia in formato base64 corretto
- Controlla che l'URL sia accessibile (se remoto)
- Usa DevTools Network per debug

## 📖 Documentazione Completa

Vedi i file di documentazione per dettagli:
- `OPERATORS_CAROUSEL_GUIDE.md` - Guida dettagliata
- `CAROUSEL_LOGIN_SETUP.md` - Riepilogo modifiche
- `COMPLETION_REPORT_CAROUSEL.md` - Report completamento

## ✅ Verifiche

- ✅ Endpoint public per operatori
- ✅ Quick-login senza password
- ✅ Supporto immagini
- ✅ Database migrato
- ✅ Componente React aggiornato
- ✅ CSS responsive
- ✅ TypeScript compilato

## 📞 Support

Per problemi o domande:
1. Consulta la documentazione
2. Controlla i log del server
3. Verifica la configurazione del database
4. Esegui i test con TEST_CAROUSEL.sh

---

**Versione**: 1.0.0  
**Data**: 12 Novembre 2025  
**Status**: ✅ Completato

