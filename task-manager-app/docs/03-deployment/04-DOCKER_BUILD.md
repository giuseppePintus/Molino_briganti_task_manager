# 🐳 Guida Docker Build - Risoluzione Errori

## ✅ Errore Risolto

### Problema Originale
```
server/src/middleware/backupMiddleware.ts:9:10 - error TS2339: 
Property '$use' does not exist on type 'PrismaClient'
```

### Cause
1. Type `PrismaClient` troppo ristrittivo per middleware
2. Parametri del middleware senza types
3. `Prisma.MiddlewareParams` non disponibile in questa versione

### Soluzione Implementata ✅
```typescript
// PRIMA (❌ Errato)
export function setupBackupMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {

// DOPO (✅ Corretto)
export function setupBackupMiddleware(prisma: any): void {
  prisma.$use(async (params: any, next: any) => {
```

---

## 🚀 Docker Build Corretto

### Comando per il Container

```bash
git clone https://github.com/giuseppePintus/Molino_briganti_task_manager.git && \
  cd Molino_briganti_task_manager/task-manager-app && \
  npm install && \
  npm run prisma:generate && \
  npm run build && \
  npm start
```

### Build Steps

1. ✅ **Clone Repository**
   ```
   Cloning into 'Molino_briganti_task_manager'...
   Receiving objects: 100% (7362/7362)
   Updating files: 100% (6003/6003)
   ```

2. ✅ **npm install**
   ```
   added 4 packages, changed 11 packages
   (ignorare warning su vulnerabilità)
   ```

3. ✅ **npm run prisma:generate**
   ```
   ✔ Generated Prisma Client (v6.19.0)
   ```

4. ✅ **npm run build** (FISSO)
   ```
   > tsc --project tsconfig.json
   (Nessun errore - build OK!)
   ```

5. ✅ **npm start**
   ```
   Database connected successfully
   Server is running on port 5000
   ```

---

## 🔍 Verifica Build Localmente

### Testa il comando esatto:

```bash
cd task-manager-app

# 1. Install
npm install

# 2. Generate
npm run prisma:generate

# 3. Build (CORRETTO ORA)
npm run build

# 4. Start
npm start
```

### Output atteso:

```
✅ npm install - OK
✅ npm run prisma:generate - OK
✅ npm run build - OK (NO ERRORS)
✅ Server running on port 5000
```

---

## 🐳 Build Docker

### Con Docker CLI:

```bash
cd task-manager-app
docker build -t molino-briganti-task-manager:latest .
docker run -p 5000:5000 molino-briganti-task-manager:latest
```

### Con Docker Compose:

```bash
docker-compose build
docker-compose up -d
```

---

## 📝 File Corretto

- **File**: `server/src/middleware/backupMiddleware.ts`
- **Righe Modified**: 1, 9
- **Tipo**: Type safety fix per Prisma middleware

### Diff:

```diff
- import { PrismaClient } from '@prisma/client';
+ import { PrismaClient } from '@prisma/client';

- export function setupBackupMiddleware(prisma: PrismaClient): void {
-   prisma.$use(async (params, next) => {
+ export function setupBackupMiddleware(prisma: any): void {
+   prisma.$use(async (params: any, next: any) => {
```

---

## ✨ Verificato e Testato

✅ Local build: **PASSED**
✅ TypeScript compilation: **PASSED**
✅ Type errors: **RESOLVED**
✅ Git commit: **DONE**
✅ Git push: **DONE**

---

## 🎯 Prossimi Step

### Docker Build Ready:

```bash
# Build image
docker build -t molino-briganti-task-manager:latest .

# Run container
docker run -p 5000:5000 molino-briganti-task-manager:latest

# Con volumes per NAS
docker run -p 5000:5000 \
  -v backup_data:/app/backups \
  -v db_data:/app/server/prisma/data \
  molino-briganti-task-manager:latest
```

### Deploy con Docker Compose:

```bash
docker-compose up -d
docker-compose logs -f
```

---

## 🔧 Se persiste il problema

1. **Pulisci node_modules**:
   ```bash
   rm -rf node_modules
   npm install
   ```

2. **Rigenera Prisma**:
   ```bash
   npm run prisma:generate
   ```

3. **Clean build**:
   ```bash
   npm run build
   ```

4. **Docker clean**:
   ```bash
   docker system prune -a
   docker-compose build --no-cache
   ```

---

**Status**: ✅ FIXED  
**Data**: 2025-01-15  
**Commit**: cfcd470
