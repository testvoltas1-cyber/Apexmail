# Multi-stage production build for Custom Domain Webmail
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build Vite frontend and Express server bundle
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

# Create upload directory
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
