# Guida Carosello Operatori

## Descrizione
Il carosello operatori è la schermata principale dell'applicazione che permette agli operatori di accedere direttamente tramite foto e nome in un carosello scorrevole. Non è richiesta password per l'accesso operatore.

## Funzionalità

### 1. Accesso Operatore
- Gli operatori vedono un carosello scorrevole con le loro foto e nomi
- Cliccando sulla foto di un operatore, viene effettuato automaticamente il login
- Non è richiesta nessuna password per l'accesso operatore
- Utilizzato il nuovo endpoint `/api/auth/quick-login`

### 2. Navigazione Carosello
- **Freccia Sinistra**: scorre al precedente operatore
- **Freccia Destra**: scorre al successivo operatore
- **Pallini indicatori**: cliccabili per saltare direttamente a un operatore

### 3. Accesso Admin
- Link "Accesso Admin" in basso per accedere come master
- Richiede username e password

## API Endpoints

### GET `/api/auth/operators/public`
Recupera la lista di tutti gli operatori (senza autenticazione).

**Risposta:**
```json
[
  {
    "id": 1,
    "username": "Operatore 1",
    "image": "data:image/png;base64,..." // opzionale
  },
  {
    "id": 2,
    "username": "Operatore 2",
    "image": null
  }
]
```

### POST `/api/auth/quick-login`
Effettua il login di un operatore senza password.

**Parametri:**
```json
{
  "operatorId": 1
}
```

**Risposta:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "Operatore 1",
    "role": "slave"
  }
}
```

### PUT `/api/auth/operators/:id/image` (Admin Only)
Aggiorna la foto di un operatore.

**Header:**
```
Authorization: Bearer <token>
```

**Parametri:**
```json
{
  "operatorId": 1,
  "image": "data:image/png;base64,..." // URL o base64
}
```

**Risposta:**
```json
{
  "message": "Operator image updated successfully",
  "operator": {
    "id": 1,
    "username": "Operatore 1",
    "image": "data:image/png;base64,..."
  }
}
```

## Struttura del Database

### Aggiornamenti Schema Prisma
È stato aggiunto il campo `image` al modello `User`:

```prisma
model User {
  id        Int       @id @default(autoincrement())
  username  String    @unique
  passwordHash String
  role      String    // 'master' or 'slave'
  image     String?   // URL o immagine base64
  createdAt DateTime  @default(now())
  
  // relazioni...
}
```

## Configurazione Immagini

Le immagini possono essere gestite in due modi:

### 1. URL Remoto
```
https://example.com/images/operatore1.jpg
```

### 2. Base64 Encoding (Consigliato per ambienti locali)
```
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
```

### Come Caricare Foto
1. Accedere come admin
2. Utilizzare l'endpoint PUT `/api/auth/operators/:id/image`
3. Inviare l'immagine come base64 o URL

## Responsive Design
- Desktop: Carosello a grandezza intera con 3 pulsanti di navigazione
- Mobile: Carosello ridotto con pulsanti più piccoli
- Adatto per touch device e mouse

## File Interessati
- `client/src/pages/OperatorsCarousel.tsx` - Componente React
- `client/src/styles/OperatorsCarousel.css` - Stili
- `server/src/controllers/authController.ts` - Logica backend
- `server/src/routes/auth.ts` - Routing
- `server/prisma/schema.prisma` - Schema database

## Migrazioni Database
La migrazione `add_image_to_user` aggiunge il campo `image` al modello User:
```
npx prisma migrate dev --name add_image_to_user
```

## Test Rapido
1. Avviare il server: `npm run dev`
2. Navigare a `http://localhost:5000`
3. Cliccare su un operatore nel carosello
4. Verifica: Sei loggato nella dashboard come quell'operatore

