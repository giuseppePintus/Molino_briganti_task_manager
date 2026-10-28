# Ibrido Dockerfile - node_modules dentro l'immagine, dist/ compilato nel build
FROM node:22-slim

WORKDIR /app

# Installa dipendenze per moduli nativi (come canvas) su Debian + MariaDB client per backup
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
  adb \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    mariadb-client \
    chromium \
    chromium-common \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Crea symlink python -> python3 per compatibilità
RUN ln -s /usr/bin/python3 /usr/bin/python

# Copia package.json e package-lock.json
COPY package*.json ./

# URL fittizio solo durante il build; la configurazione runtime arriva dall'env-file
ARG DATABASE_URL=mysql://localhost:3306/prisma_build

# Copia schema prisma
COPY server/prisma/ ./server/prisma/
COPY prisma.config.ts ./

# Installa dipendenze dal lockfile con cache temporanea isolata
RUN npm ci --no-audit --no-fund --cache=/tmp/npm-cache-prisma7 && rm -rf /tmp/npm-cache-prisma7

# Genera il client Prisma per il runtime CommonJS
RUN npx prisma generate --schema=./server/prisma/schema.prisma

# Copia public/ (statico)
COPY public/ public/

# Copia il dist/ compilato
COPY server/dist/ ./server/dist/

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Avvia il server
CMD ["node", "server/dist/index.js"]
