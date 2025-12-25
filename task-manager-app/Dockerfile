# Ibrido Dockerfile - node_modules dentro l'immagine, dist/ via bind mount
FROM node:18-alpine

WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa SOLO le dipendenze di production
RUN npm install --production

# Copia public/ (statico, necessario per servire HTML)
COPY public/ public/

# Copia .env se esiste
COPY .env* ./ || true

# NON copiamo dist/ - sarà montato via bind mount durante il run

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

# Avvia il server (dist/ sarà disponibile dal bind mount)
CMD ["node", "dist/index.js"]
