FROM node:20-slim

# Build args for Vite client env vars (baked into bundle at build time)
# Railway passes env vars as build args when building
ARG VITE_BASE_URL
ARG VITE_GOOGLE_PLACES_API_KEY
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV VITE_GOOGLE_PLACES_API_KEY=$VITE_GOOGLE_PLACES_API_KEY

WORKDIR /app

# Copy everything (frontend + backend)
COPY homeops-backend ./homeops-backend
COPY homeops-frontend ./homeops-frontend

# Install backend dependencies
WORKDIR /app/homeops-backend
RUN npm install --omit=dev

# Install pnpm, build frontend, copy to backend/public
RUN npm install -g pnpm && \
    cd /app/homeops-frontend && pnpm install && \
    cd /app/homeops-backend && node scripts/build-client.js && \
    npm uninstall -g pnpm && \
    rm -rf /app/homeops-frontend

EXPOSE 3000

CMD ["node", "server.js"]
