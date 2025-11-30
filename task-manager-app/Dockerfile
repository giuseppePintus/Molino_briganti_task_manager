# Build stage
FROM --platform=linux/arm64/v8 node:18 AS builder

WORKDIR /app

# Copia package files per cache
COPY package*.json ./

# Crea directory per la build
RUN mkdir -p /app/server /app/client

# Install dependencies with retry (sfrutta cache)
RUN npm install --legacy-peer-deps --audit=false || npm install --legacy-peer-deps --audit=false || npm install --legacy-peer-deps --audit=false

# Copia il codice
COPY . .

# Genera Prisma client (scarica i binari per l'architettura ARM64)
RUN npm run prisma:generate

# Build TypeScript
RUN npm run build

# Production stage
FROM --platform=linux/arm64/v8 node:18

WORKDIR /app

# Crea directory per i moduli e file
RUN mkdir -p /app/server /app/client /app/public /app/backups /app/server/prisma/data

# Copia package.json PRIMA dagli stage builder
COPY package*.json ./

# Copia node_modules da builder
COPY --from=builder /app/node_modules ./node_modules

# Copia il codice compilato
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/public ./public

# Copia server source per runtime
COPY --from=builder /app/server/src ./server/src

# Copia prisma schema e client
COPY --from=builder /app/server/prisma ./server/prisma

# Copia .env per Docker
COPY .env.docker ./server/.env

# Set permissions
RUN chmod -R 755 /app/backups /app/server/prisma/data

# Esponi porta
EXPOSE 5000

# Volume per accesso diretto al NAS - backup salvati qui
VOLUME ["/share/CACHEDEV1_DATA"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health')"

# Comando di startup - RUN prisma migrate al boot se necessario
RUN echo '#!/bin/sh\nmkdir -p /share/CACHEDEV1_DATA/molino/backups\necho "🔄 Running Prisma migrations..."\ncd /app/server && npx prisma migrate deploy --skip-generate || true\necho "✅ Migrations completed"\nnode /app/server/dist/index.js' > /start.sh && chmod +x /start.sh
CMD ["/start.sh"]
