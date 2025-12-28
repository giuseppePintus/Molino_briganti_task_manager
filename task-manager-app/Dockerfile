# Ibrido Dockerfile - node_modules dentro l'immagine, dist/ via bind mount
FROM node:20-slim

WORKDIR /app

# Installa dipendenze per moduli nativi (come canvas) su Debian
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia package.json e package-lock.json
COPY package*.json ./

# Copia schema prisma
COPY server/prisma/ ./prisma/

# Installa SOLO le dipendenze di production
RUN npm install --omit=dev

# Installa prisma temporaneamente per la generazione
RUN npm install prisma

# Genera il client Prisma per l'architettura corrente
RUN npx prisma generate

# Copia public/ (statico, necessario per servire HTML)
COPY public/ public/

# Copia il codice compilato (dist)
COPY server/dist/ dist/

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Avvia il server (dist/ sarà disponibile dal bind mount)
CMD ["node", "dist/index.js"]
