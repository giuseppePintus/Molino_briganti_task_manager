================================================================================
                     📖 GUIDA RAPIDA ALLA RIGENERAZIONE
                    Molino Briganti Task Manager - v1.0.1
================================================================================

🎯 TRE FILE PRINCIPALI CHE HAI CREATO:

1. PROGETTO_RIGENERAZIONE_PROMPT.txt
   - Specifica COMPLETA del progetto
   - Cosa, Come, Perché
   - Per capire l'architettura

2. STEP_BY_STEP_IMPLEMENTATION.txt
   - Roadmap PASSO DOPO PASSO
   - Segui in ordine (non saltare!)
   - Per IMPLEMENTARE il progetto

3. ANTI_PATTERN_GUIDE.txt
   - ERRORI da evitare
   - Lezioni imparate
   - Per NON RIPETERE gli stessi errori

================================================================================
⚡ QUICK START - DA ZERO IN 30 MINUTI
================================================================================

STEP 1: Leggi primo i 3 file (20 minuti)
  [ ] PROGETTO_RIGENERAZIONE_PROMPT.txt (overview)
  [ ] ANTI_PATTERN_GUIDE.txt (cosa NON fare)
  [ ] STEP_BY_STEP_IMPLEMENTATION.txt (come fare)

STEP 2: Setup iniziale (5 minuti)
  mkdir molino-task-manager-new
  cd molino-task-manager-new
  npm init -y
  npm install express typescript ts-node @types/express @types/node
  npm install prisma @prisma/client jsonwebtoken bcryptjs cors body-parser multer csv-parser dotenv

STEP 3: Crea struttura (2 minuti)
  mkdir -p server/src/{controllers,routes,middleware,models,services,data}
  mkdir -p server/prisma/{data,migrations}
  mkdir -p public/{css,js,data,images}
  mkdir backups

STEP 4: Database (1 minuto)
  npx prisma init
  [Copia schema.prisma dal PROMPT]
  npx prisma generate
  npx prisma migrate dev --name init

STEP 5: Backend (2 minuti)
  [Copia index.ts, controllers, routes dal STEP_BY_STEP]
  npm run build
  npm run dev

STEP 6: Frontend (1 minuto)
  [Copia HTML files da repo esistente]
  Apri: http://localhost:5000

STEP 7: Docker (1 minuto)
  [Copia Dockerfile, docker-compose.yml dal repo]
  docker compose build
  docker compose up -d

✅ PRONTO! 30 minuti.

================================================================================
📋 CHECKLIST COMPLETA
================================================================================

PRIMA DI INIZIARE:
  [ ] Ho letto tutti e 3 i file di guida
  [ ] Conosco i 19 errori comuni (ANTI_PATTERN_GUIDE)
  [ ] Ho Node.js 18+ installato
  [ ] Ho Docker Desktop installato

FASE 1 - SETUP INIZIALE:
  [ ] Crea directory progetto
  [ ] npm init
  [ ] npm install dipendenze
  [ ] Crea struttura cartelle
  [ ] tsconfig.json creato

FASE 2 - DATABASE:
  [ ] npx prisma init
  [ ] .env configurato
  [ ] schema.prisma completato
  [ ] prisma generate ok
  [ ] prisma migrate dev completato
  [ ] seed.ts crea admin user
  [ ] npm run prisma:seed completato

FASE 3 - BACKEND EXPRESS:
  [ ] server/src/index.ts creato
  [ ] Middleware setup (cors, bodyParser)
  [ ] Routes importate
  [ ] Controllers creati (auth, order, inventory)
  [ ] Error handler implementato
  [ ] npm run build ✅
  [ ] npm run dev ✅ (test on localhost:5000)

FASE 4 - FRONTEND:
  [ ] public/index.html creato
  [ ] public/css/common.css creato
  [ ] admin-dashboard.html creato (vedi template)
  [ ] orders-planner.html creato (vedi template)
  [ ] warehouse-management.html creato
  [ ] Tutte le pagine testabili sul localhost

FASE 5 - CSV & DATA:
  [ ] public/data/clienti.csv template
  [ ] public/data/articoli.csv (140 items)
  [ ] CSV import endpoint implementato
  [ ] Test import: 140 articoli

FASE 6 - DOCKER:
  [ ] Dockerfile creato (2 stages)
  [ ] docker-compose.yml creato
  [ ] docker-start.sh script
  [ ] .dockerignore completo (60+ entries)
  [ ] docker compose build ✅
  [ ] docker compose up -d ✅
  [ ] http://localhost:5000 ✅

FASE 7 - TESTING:
  [ ] Login works (master/masterpass)
  [ ] Create order works
  [ ] CSV import works (140 items)
  [ ] Modify order works
  [ ] Delete order works
  [ ] Warehouse management works
  [ ] Company settings works
  [ ] Backup works

FASE 8 - DEPLOYMENT NAS:
  [ ] Build image: docker build -t molino-task-manager:v1.0.1 .
  [ ] SSH al NAS: ssh vsc@192.168.1.248
  [ ] Pull/load image on NAS
  [ ] docker compose down/up on NAS
  [ ] Test: http://192.168.1.248:5000

DOCUMENTAZIONE:
  [ ] README.md aggiornato
  [ ] DEPLOYMENT_MEMORY.md aggiornato
  [ ] CHANGELOG.md creato
  [ ] schema.prisma commentato
  [ ] API endpoints documentati

================================================================================
🚀 QUICK COMMANDS
================================================================================

LOCAL DEVELOPMENT:
  npm install                    # Installa dipendenze
  npm run prisma:generate        # Genera Prisma client
  npm run prisma:seed            # Seed data iniziali
  npm run build                  # Compila TypeScript
  npm run dev                    # Dev mode con auto-reload
  npm start                      # Produce mode

PRISMA:
  npx prisma studio             # Open DB GUI
  npx prisma migrate dev         # Create migration
  npx prisma generate           # Generate client
  npx prisma db push            # Sync schema

DOCKER:
  docker compose build           # Build image
  docker compose up -d           # Start containers
  docker compose down            # Stop containers
  docker compose logs -f         # View logs
  docker compose restart         # Restart
  docker system prune -a -f      # Clean everything

TESTING:
  curl http://localhost:5000/health                    # Health check
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"master","password":"masterpass"}'  # Login

NAS DEPLOYMENT:
  ssh vsc@192.168.1.248          # SSH to NAS
  cd ~/molino-app                # Go to app dir
  docker compose ps              # Check status
  docker compose logs            # View logs
  http://192.168.1.248:5000      # Access app

================================================================================
🎓 FILE REFERENCE MAP
================================================================================

SPECIFICA PROGETTO:
  📄 PROGETTO_RIGENERAZIONE_PROMPT.txt
     - Architettura completa
     - Stack tecnologico
     - Database schema
     - API endpoints
     - Frontend features
     - Docker setup

IMPLEMENTAZIONE:
  📄 STEP_BY_STEP_IMPLEMENTATION.txt
     - Fase 1: Setup iniziale
     - Fase 2: Database Prisma
     - Fase 3: Backend Express
     - Fase 4: Controllers
     - Fase 5: Routes
     - Fase 6: Build & Test
     - Fase 7: Frontend
     - Fase 8: Docker
     - Fase 9: CSV & Data
     - Fase 10: Deploy

ANTI-PATTERN:
  📄 ANTI_PATTERN_GUIDE.txt
     - 19 errori comuni
     - Root cause per ogni
     - Soluzione implementata
     - Come prevenire

QUICK REFERENCE:
  📄 QUESTA FILE (README_RIGENERAZIONE.txt)
     - Panoramica
     - Checklist
     - Quick commands
     - Links di riferimento

================================================================================
🔍 TROUBLESHOOTING RAPIDO
================================================================================

PROBLEMA: "column does not exist" error
  → Vedi ERRORE #1 in ANTI_PATTERN_GUIDE
  → Soluzione: Rimuovi ./server/prisma:ro da docker-compose.yml

PROBLEMA: Container non parte
  → Vedi ERRORE #2 in ANTI_PATTERN_GUIDE
  → Soluzione: Semplifica docker-start.sh, lascia app gestire DB

PROBLEMA: CSV import fallisce
  → Vedi ERRORE #4-6 in ANTI_PATTERN_GUIDE
  → Soluzione: Usa prisma.upsert(), gestisci encoding BOM

PROBLEMA: Modal mostra codice HTML
  → Vedi ERRORE #7 in ANTI_PATTERN_GUIDE
  → Soluzione: Verifica articoli.length > 0 prima di usare

PROBLEMA: 401 Unauthorized
  → Vedi ERRORE #8 in ANTI_PATTERN_GUIDE
  → Soluzione: API_URL dinamico + JWT in header

PROBLEMA: Build lentissimo
  → Vedi ERRORE #12 in ANTI_PATTERN_GUIDE
  → Soluzione: .dockerignore esteso + Dockerfile layers ordinati

================================================================================
✨ BEST PRACTICES RIASSUNTO
================================================================================

CODE:
  ✅ Usa TypeScript per type safety
  ✅ Prisma per query safety
  ✅ JWT per autenticazione stateless
  ✅ Bcrypt per password hashing
  ✅ Input validation ovunque
  ✅ Error logging dettagliato
  ✅ Comments per logica complessa

DATABASE:
  ✅ Schema.prisma come SOURCE OF TRUTH
  ✅ Migrazioni tracked in git
  ✅ Backup automatici
  ✅ Test con dati reali (140+ items)
  ✅ Performance queries con include/select

FRONTEND:
  ✅ HTML vanilla (no frameworks)
  ✅ localStorage per token/data
  ✅ window.location.hostname per URL dinamici
  ✅ Console.log intelligenti (non loop 100+)
  ✅ Responsive CSS mobile-first
  ✅ Buttons sempre con testo + emoji

DOCKER:
  ✅ .dockerignore completo
  ✅ Dockerfile layers ordinati (stable first)
  ✅ Healthcheck su ogni container
  ✅ Volumes per persistence
  ✅ Build locally prima di push
  ✅ Test su localhost prima di NAS

DEPLOYMENT:
  ✅ Versiona releases (v1.0.1, v1.0.2)
  ✅ Git tags per ogni release
  ✅ DEPLOYMENT_MEMORY aggiornato
  ✅ CHANGELOG registra ogni change
  ✅ Test checklist prima di deploy
  ✅ Backup DB prima di major changes

TEAM:
  ✅ Documentazione completa
  ✅ Code comments per non-ovvio
  ✅ Architecture decisions registrate
  ✅ Anti-pattern guide condiviso
  ✅ Post-mortem per errori
  ✅ Lessons learned documented

================================================================================
📞 SUPPORT & RESOURCES
================================================================================

DOCUMENTATION:
  - Express: https://expressjs.com/
  - Prisma: https://www.prisma.io/docs/
  - TypeScript: https://www.typescriptlang.org/docs/
  - Docker: https://docs.docker.com/
  - JWT: https://jwt.io/introduction

DEBUGGING:
  - Browser DevTools (F12)
  - Prisma Studio: npx prisma studio
  - Docker Logs: docker compose logs -f
  - Network tab per API calls

COMMON ISSUES:
  - Database locked: docker volume prune -f
  - Port already in use: lsof -i :5000
  - Build cache issues: docker system prune -a
  - Permission denied: chmod +x docker-start.sh

================================================================================
✅ FINAL CHECKLIST PRIMA DI RIGENERARE
================================================================================

  [ ] Ho capito l'architettura completa
  [ ] Conosco tutti i 19 errori comuni
  [ ] So come evitarli
  [ ] Node.js 18+ installato
  [ ] Docker Desktop running
  [ ] Ho tempo per 2-3 ore (first time)
  [ ] Ho backup del progetto vecchio
  [ ] Ho documentazione leggibile
  [ ] So come deployare su NAS
  [ ] Sono pronto a partire!

🚀 LET'S GO!

================================================================================
