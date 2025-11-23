# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copia package files
COPY task-manager-app/package*.json ./

# Crea directory per la build
RUN mkdir -p /app/server /app/client

# Install dependencies
RUN npm install

# Copia il codice
COPY task-manager-app/ .

# Genera Prisma client (scarica i binari per l'architettura corrente)
RUN npm run prisma:generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init per gestione corretta dei segnali
RUN apk add --no-cache dumb-init

# Crea directory per i moduli e file
RUN mkdir -p /app/server /app/client /app/public /app/backups /app/server/prisma/data

# Copia node_modules da builder
COPY --from=builder /app/node_modules ./node_modules

# Copia il codice compilato
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copia server source per runtime
COPY --from=builder /app/server/src ./server/src

# Copia prisma schema e client
COPY --from=builder /app/server/prisma ./server/prisma

# Copia .env per Docker
COPY task-manager-app/.env.docker ./server/.env

# Set permissions
RUN chmod -R 755 /app/backups /app/server/prisma/data

# Esponi porta
EXPOSE 5000

# Volume per backups locali
VOLUME ["/app/backups"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health')"

# Copia entrypoint script
COPY task-manager-app/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Usa dumb-init per startup
ENTRYPOINT ["dumb-init", "--"]

# Comando di startup
CMD ["/app/entrypoint.sh"]
