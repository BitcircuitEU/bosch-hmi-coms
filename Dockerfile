# Multi-stage build für Frontend + Backend
FROM node:18-alpine as frontend-build

# Frontend bauen
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Backend Stage
FROM node:18-alpine as backend

# Arbeitsverzeichnis setzen
WORKDIR /app

# Backend Dependencies installieren
COPY backend/package*.json ./
RUN npm install --only=production

# Backend Source Code kopieren
COPY backend/ ./

# Frontend Build aus dem Frontend-Stage kopieren
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Port freigeben
EXPOSE 3000

# Health Check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Anwendung starten
CMD ["npm", "start"]
