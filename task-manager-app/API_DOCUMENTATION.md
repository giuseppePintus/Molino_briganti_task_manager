# Task Manager App - Master/Slave Task Management System

Una web app per la gestione dei compiti con un sistema master-slave dove:
- **Master**: può creare, modificare e cancellare compiti
- **Slave**: può aggiungere note ai compiti e spuntarli come completati

## Requisiti

- Node.js >= 14
- npm

## Installazione

```bash
cd task-manager-app
npm install
```

## Configurazione

1. Copia le variabili d'ambiente (già presenti in `server/.env`):
```
DATABASE_URL="file:./data/tasks.db"
JWT_SECRET="your_jwt_secret_key_change_this"
PORT=5000
NODE_ENV=development
DEFAULT_MASTER_USER="master"
DEFAULT_MASTER_PASS="masterpass"
```

2. Inizializza il database:
```bash
npm run prisma:seed
```

## Avvio

### Modalità Production
```bash
npm run build
npm start
```

### Modalità Development
```bash
npm run dev
```

## Credenziali di Default

- **Username**: `master`
- **Password**: `masterpass`
- **Role**: `master`

## API Endpoints

### Autenticazione

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "master",
  "password": "masterpass"
}

Response:
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "master",
    "role": "master"
  }
}
```

#### Registra Nuovo Utente (solo Master)
```
POST /api/auth/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "slave1",
  "password": "password123",
  "role": "slave"
}

Response:
{
  "message": "User registered successfully",
  "userId": 2
}
```

### Task Management

Tutti gli endpoint richiedono il token di autenticazione nell'header:
```
Authorization: Bearer <token>
```

#### Ottieni Elenco Compiti
```
GET /api/tasks

Response:
[
  {
    "id": 1,
    "title": "Installazione server",
    "description": "Installare e configurare il server",
    "scheduledAt": "2025-11-15T09:00:00.000Z",
    "assignedOperator": {
      "id": 2,
      "username": "slave1",
      "role": "slave"
    },
    "estimatedMinutes": 120,
    "createdBy": {
      "id": 1,
      "username": "master"
    },
    "completed": false,
    "completedBy": null,
    "actualMinutes": null,
    "completedAt": null,
    "notes": []
  }
]
```

#### Crea Nuovo Compito (solo Master)
```
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Configurare database",
  "description": "Installare e configurare PostgreSQL",
  "scheduledAt": "2025-11-15T14:00:00Z",
  "assignedOperatorId": 2,
  "estimatedMinutes": 90
}

Response:
{
  "id": 1,
  "title": "Configurare database",
  "description": "Installare e configurare PostgreSQL",
  "scheduledAt": "2025-11-15T14:00:00.000Z",
  "assignedOperatorId": 2,
  "estimatedMinutes": 90,
  "createdById": 1,
  "completed": false,
  "createdAt": "2025-11-09T10:25:00.000Z"
}
```

#### Modifica Compito (solo Master)
```
PUT /api/tasks/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Configurare database PostgreSQL",
  "estimatedMinutes": 120
}

Response:
{
  "id": 1,
  "title": "Configurare database PostgreSQL",
  ...
}
```

#### Cancella Compito (solo Master)
```
DELETE /api/tasks/:id
Authorization: Bearer <token>

Response: 204 No Content
```

#### Aggiungi Nota al Compito e Spunta (Slave)
```
POST /api/tasks/:id/notes
Authorization: Bearer <token>
Content-Type: application/json

{
  "note": "Database configurato con successo",
  "actualMinutes": 85,
  "markCompleted": true
}

Response:
{
  "id": 1,
  "taskId": 1,
  "userId": 2,
  "note": "Database configurato con successo",
  "createdAt": "2025-11-09T10:30:00.000Z",
  "user": {
    "id": 2,
    "username": "slave1"
  }
}
```

#### Ottieni Note di un Compito
```
GET /api/tasks/:id/notes
Authorization: Bearer <token>

Response:
[
  {
    "id": 1,
    "taskId": 1,
    "userId": 2,
    "note": "Database configurato",
    "createdAt": "2025-11-09T10:30:00.000Z",
    "user": {
      "id": 2,
      "username": "slave1"
    }
  }
]
```

#### Health Check
```
GET /api/health

Response:
{
  "status": "ok"
}
```

## Struttura del Database

### User
- `id`: ID univoco
- `username`: Nome utente unico
- `passwordHash`: Password hashata con bcrypt
- `role`: 'master' o 'slave'
- `createdAt`: Data di creazione

### Task
- `id`: ID univoco
- `title`: Titolo del compito
- `description`: Descrizione
- `scheduledAt`: Data e ora di esecuzione
- `assignedOperatorId`: ID dell'operatore a cui è assegnato
- `estimatedMinutes`: Tempo stimato in minuti
- `createdById`: ID dell'utente che ha creato il compito
- `createdAt`: Data di creazione
- `completed`: Se il compito è completato
- `completedById`: ID di chi ha completato il compito
- `actualMinutes`: Tempo effettivamente impiegato
- `completedAt`: Data di completamento

### TaskNote
- `id`: ID univoco
- `taskId`: ID del compito associato
- `userId`: ID dell'utente che ha aggiunto la nota
- `note`: Contenuto della nota
- `createdAt`: Data di creazione

## Flusso di Utilizzo

1. **Login**: Master e Slave si loggano con le proprie credenziali
2. **Creazione Compiti**: Master crea nuovi compiti assegnandoli a Slave specifici
3. **Visualizzazione**: 
   - Master vede tutti i compiti
   - Slave vede solo i compiti assegnati a lui
4. **Completamento**: Slave aggiunge note e marca il compito come completato
5. **Monitoraggio**: Master può monitorare il progresso di tutti i compiti

## Note di Compatibilità

Questa applicazione è progettata per funzionare con JellyBean e versioni successive di Android attraverso API REST.

## Licenza

MIT
