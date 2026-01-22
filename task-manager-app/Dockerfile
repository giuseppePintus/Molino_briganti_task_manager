# Ibrido Dockerfile - node_modules dentro l'immagine, dist/ compilato nel build
FROM --platform=linux/arm64 node:20-slim

WORKDIR /app

# Installa dipendenze per moduli nativi (come canvas) su Debian + Python per PDF extraction + MariaDB client per backup
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    mariadb-client \
    && rm -rf /var/lib/apt/lists/*

# Installa Python packages necessari per PDF extraction
RUN pip3 install --no-cache-dir --break-system-packages pdfplumber pandas

# Crea symlink python -> python3 per compatibilità
RUN ln -s /usr/bin/python3 /usr/bin/python

# Copia package.json e package-lock.json
COPY package*.json ./

# Copia schema prisma
COPY server/prisma/ ./server/prisma/

# Copia .env
COPY server/.env ./

# Installa dipendenze
RUN npm install

# Installa prisma@6.19.0 esplicitamente (NOT prisma@7 che ha sintassi diversa!)
RUN npm install prisma@6.19.0

# Genera il client Prisma PRIMA di copiare dist
# Questo è CRITICO: serve lo schema.prisma che è già stato copiato sopra
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
