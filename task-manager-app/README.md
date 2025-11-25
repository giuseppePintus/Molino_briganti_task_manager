# Task Manager App - Master/Slave System

Un'applicazione web per la gestione dei compiti con un sistema master-slave, ideale per coordinare operatori nel campo della manutenzione, logistica o operazioni tecniche.

## Caratteristiche

✅ **Autenticazione** - Login sicuro con JWT  
✅ **Master Control** - Creazione, modifica e cancellazione di compiti  
✅ **Multi-Slave** - Supporto per più operatori  
✅ **Compiti Personalizzati** - Titolo, descrizione, data/ora, operatore, tempo stimato  
✅ **Note e Tracciamento** - Slave può aggiungere note e marcare completamento  
✅ **Database SQLite** - Persistenza locale senza dipendenze esterne  
✅ **API REST** - Pronta per integrazioni mobile (Jellybean+)  
✅ **Gestione Magazzino** - Tracciamento scorte, avvisi minimo, ordini integrati  
✅ **Backup Automatico** - Backup ogni ora con ripristino da NAS  
✅ **Dashboard Operatori** - Interfaccia dedicata per gli operatori  

## 📦 Nuovo: Gestione Magazzino

È stato integrato un **sistema completo di gestione magazzino** con:

- **Tracciamento Articoli**: Codice, descrizione, categoria, unità di misura
- **Inventario Real-time**: Stock attuale, minimo, posizione scaffale
- **Avvisi Automatici**: Notifiche quando stock scende sotto il minimo impostato
- **Storico Movimenti**: Traccia ogni entrata/uscita con motivo e utente
- **Integrazione Ordini**: Riduce automaticamente stock quando gli ordini vengono creati
- **Esportazione Dati**: Export CSV per report e backup
- **Interfaccia Web**: Dashboard dedicata per gestire tutto il magazzino

### Accesso Gestione Magazzino

```
http://localhost:5000/inventory-management.html
```

### Quick Start Magazzino

1. **Importa articoli**: Tab "Importa Dati" → "Importa Articoli da CSV"
2. **Visualizza inventario**: Tab "Inventario" → Lista completa articoli
3. **Imposta soglie minime**: Clicca "Modifica" su un articolo
4. **Monitora avvisi**: Tab "Avvisi" → Articoli in allarme
5. **Esporta report**: Tab "Inventario" → "Esporta CSV"

**Documentazione Dettagliata**: Vedi [WAREHOUSE_MANAGEMENT_GUIDE.md](./WAREHOUSE_MANAGEMENT_GUIDE.md)

## Quickstart

### Prerequisiti
- Node.js >= 14
- npm

### Installazione

```bash
# Entra nella directory del progetto
cd task-manager-app

# Installa dipendenze
npm install

# Crea il database e inserisci l'utente master
npm run prisma:seed

# Compila TypeScript
npm run build

# Avvia il server
npm start
```

Il server sarà disponibile su `http://localhost:5000`

### Credenziali di Default

| Campo | Valore |
|-------|--------|
| Username | `master` |
| Password | `masterpass` |
| Role | `master` |

## Modalità Development

```bash
npm run dev  # Con auto-reload tramite ts-node
```

## Architettura

```
task-manager-app/
├── server/
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── controllers/       # Logica business
│   │   ├── routes/           # Definizione endpoint
│   │   ├── middleware/       # Auth, validation
│   │   ├── models/           # Data models
│   │   └── services/         # Servizi
│   ├── prisma/
│   │   ├── schema.prisma     # Schema database
│   │   └── seed.ts           # Seed data
│   └── .env                  # Variabili ambiente
├── client/                    # Client React (future)
└── package.json
```

## API Endpoints

### 🔐 Autenticazione

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login utente |
| POST | `/api/auth/register` | Registra nuovo utente (solo Master) |

### 📋 Task Management

| Metodo | Endpoint | Descrizione | Ruolo |
|--------|----------|-------------|-------|
| GET | `/api/tasks` | Lista compiti | Master/Slave |
| POST | `/api/tasks` | Crea compito | Master |
| PUT | `/api/tasks/:id` | Modifica compito | Master |
| DELETE | `/api/tasks/:id` | Cancella compito | Master |
| POST | `/api/tasks/:id/notes` | Aggiungi nota | Slave |
| GET | `/api/tasks/:id/notes` | Leggi note | Master/Slave |

Consulta `API_DOCUMENTATION.md` per i dettagli completi con esempi.

## Modello Dati

### Users
- **id**: Identificativo univoco
- **username**: Nome utente unico
- **passwordHash**: Password sicura (bcrypt)
- **role**: 'master' o 'slave'
- **createdAt**: Timestamp creazione

### Tasks
- **id**: Identificativo univoco
- **title**: Nome del compito
- **description**: Descrizione dettagliata
- **scheduledAt**: Data e ora di esecuzione
- **assignedOperatorId**: ID dell'operatore assegnato
- **estimatedMinutes**: Tempo previsto (minuti)
- **createdById**: Chi ha creato il compito
- **completed**: Stato completamento
- **completedById**: Chi ha completato
- **actualMinutes**: Tempo effettivo impiegato
- **completedAt**: Timestamp completamento

### TaskNotes
- **id**: Identificativo univoco
- **taskId**: Riferimento al task
- **userId**: Chi ha aggiunto la nota
- **note**: Contenuto nota
- **createdAt**: Timestamp creazione

## Flusso di Utilizzo

1. **Master si autentica** → Login con credenziali master
2. **Master crea compito** → Definisce titolo, data, operatore, tempo stimato
3. **Slave visualizza** → Vede i compiti assegnati
4. **Slave esegue** → Aggiunge note di progresso
5. **Slave completa** → Marca come done, inserisce tempo effettivo
6. **Master monitora** → Visione completa di tutti i compiti

## Variabili di Ambiente

Edita `server/.env`:

```env
# Database
DATABASE_URL="file:./data/tasks.db"

# JWT
JWT_SECRET="your_secret_key_here"

# Server
PORT=5000
NODE_ENV=development

# Default Master
DEFAULT_MASTER_USER="master"
DEFAULT_MASTER_PASS="masterpass"
```

## Script npm

```bash
npm start              # Avvia server production
npm run dev           # Avvia server development (auto-reload)
npm run build         # Compila TypeScript
npm run prisma:seed   # Crea database e utente master
npm test              # Run tests
```

## Compatibilità

- ✅ **Jellybean (API 16+)** - Supporto per client Android
- ✅ **Modern Browsers** - Chrome, Firefox, Safari, Edge
- ✅ **REST API** - Agnostica al client

## Sviluppo

### Aggiungere un nuovo endpoint

1. Crea controller method in `server/src/controllers/`
2. Definisci route in `server/src/routes/`
3. Implementa middleware se necessario
4. Registra route in `server/src/index.ts`
5. Compila: `npm run build`

### Aggiungere un nuovo modello

1. Modifica `server/prisma/schema.prisma`
2. Esegui: `npx prisma db push --schema=server/prisma/schema.prisma`
3. Generato automaticamente in `@prisma/client`

## Troubleshooting

**Errore: "Database connection error"**
- Verifica che `DATABASE_URL` sia impostato in `.env`
- Esegui `npm run prisma:seed`

**Errore: "tsc: not found"**
- Esegui `npm install --save-dev typescript`

**Errore: "token expired"**
- Fai login di nuovo per ottenere nuovo token

**Errore: "Cannot find module"**
- Esegui `npm install`
- Ricompila: `npm run build`

## Future Enhancements

- [ ] Dashboard React per client web
- [ ] Notifiche in real-time (WebSocket)
- [ ] Export report CSV/PDF
- [ ] Storico versioni compiti
- [ ] File attachment per compiti
- [ ] Priorità compiti
- [ ] Team collaboration

## Licenza

MIT

## Support

Per domande o issues, contatta il team di sviluppo.

---

**Made with ❤️ for task management**

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd task-manager-app
   ```

2. Install server dependencies:
   ```
   cd server
   npm install
   ```

3. Install client dependencies:
   ```
   cd client
   npm install
   ```

4. Set up the database:
   - Configure your database connection in the `.env` file located in the `server` directory.
   - Run the Prisma migrations to set up the database schema.

### Running the Application
1. Start the server:
   ```
   cd server
   npm start
   ```

2. Start the client:
   ```
   cd client
   npm start
   ```

### Usage
- Navigate to the client application in your browser to access the login page.
- Master users can create and manage tasks, while slave users can complete tasks and add notes.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.