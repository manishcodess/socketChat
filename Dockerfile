# ==========================================
# Multi-Stage Dockerfile for Full-Stack App
# Stage 1: Build Frontend Assets (Vite)
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Server (Express + Sockets)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app/backend

# Install production dependencies
COPY backend/package*.json ./
RUN npm install --only=production

# Copy backend source code
COPY backend/ ./

# Copy compiled frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Render sets $PORT dynamically (default: 10000 or 4000)
ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

# Start production server
CMD ["node", "server.js"]
