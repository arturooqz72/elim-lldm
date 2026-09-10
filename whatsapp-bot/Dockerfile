FROM node:20-bookworm-slim

# Chromium del sistema para whatsapp-web.js (Puppeteer) — más liviano
# y estable en Docker que descargar el Chromium propio de Puppeteer.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Quita las devDependencies (typescript, ts-node, @types/*) ya
# compilado, para que la imagen final quede más pequeña.
RUN npm prune --omit=dev

# La sesión de WhatsApp (LocalAuth) se guarda aquí — monta un volumen
# en esta ruta para no tener que volver a escanear el QR en cada
# despliegue (ver docker-compose.yml).
VOLUME ["/app/session"]

CMD ["node", "dist/index.js"]
