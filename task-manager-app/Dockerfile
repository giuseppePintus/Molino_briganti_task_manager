# Build stage
FROM --platform=linux/arm64/v8 node:18 AS builder

WORKDIR /app

# Copia SOLO package files PRIMA per sfruttare la cache layer npm install
COPY package*.json ./

# Install dependencies with retry (layer stabile per cache)
RUN npm install --legacy-peer-deps --audit=false || npm install --legacy-peer-deps --audit=false || npm install --legacy-peer-deps --audit=false

# Crea directory per la build
RUN mkdir -p /app/server /app/client

# Copia il resto del codice (layer instabile - cambia spesso)
COPY . .

# Genera Prisma client (scarica i binari per l'architettura ARM64)
RUN npm run prisma:generate

# Build TypeScript (layer finale - recompila solo se codice cambia)
RUN npm run build

# Production stage - slimmed down
FROM --platform=linux/arm64/v8 node:18

WORKDIR /app

# Crea directory per runtime (singolo RUN = singolo layer)
RUN mkdir -p /app/server /app/client /app/public /app/backups /app/server/prisma/data && \
    chmod -R 755 /app/backups /app/server/prisma/data

# Copia package.json per riferimento
COPY package*.json ./

# Copia node_modules da builder (layer reusabile se package.json non cambia)
COPY --from=builder /app/node_modules ./node_modules

# Copia artefatti compilati da builder in singolo COPY (riduce layer)
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src ./server/src
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/public ./public

# Copia .env per Docker
COPY .env.docker ./server/.env

# Crea directory per backups nel bind mount
RUN mkdir -p /data/molino/backups

# Esponi porta
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health')"

# Copia script di startup
COPY docker-start.sh /start.sh
RUN chmod +x /start.sh

# Comando di startup
CMD ["/start.sh"]
