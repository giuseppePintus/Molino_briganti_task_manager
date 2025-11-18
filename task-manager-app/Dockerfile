# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copia package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd server && npm install
RUN cd client && npm install

# Copia il codice
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init per gestione corretta dei segnali
RUN apk add --no-cache dumb-init

# Copia node_modules da builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/client/node_modules ./client/node_modules

# Copia il codice compilato
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server/.env ./server/.env
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/prisma ./server/prisma

# Copia script di startup
COPY --from=builder /app/server/prisma/seed.ts ./server/prisma/

# Esponi porta
EXPOSE 5000

# Crea cartelle necessarie
RUN mkdir -p /app/backups /mnt/nas/backups /app/server/prisma/data

# Volume per backups locali e NAS
VOLUME ["/app/backups", "/mnt/nas/backups"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Usa dumb-init per startup
ENTRYPOINT ["dumb-init", "--"]

# Comando di startup
CMD ["node", "server/dist/index.js"]
