FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY backend/*.js ./
COPY frontend/ /app/frontend/
COPY database/schema.sql database/seed.sql /app/database/
USER node
EXPOSE 3000
CMD ["node", "server.js"]
