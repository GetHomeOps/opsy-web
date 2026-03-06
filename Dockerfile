FROM node:20-slim

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
