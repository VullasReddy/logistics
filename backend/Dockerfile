# ---------------------------------------------------------------
# TTC Fleet360 - Backend image
# Build:  docker build -t fleet360-backend ./backend
# ---------------------------------------------------------------
FROM node:22-alpine

WORKDIR /app

# Install only production dependencies first (better layer caching:
# this step re-runs only when package*.json changes)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the source code
COPY src ./src
COPY db ./db

ENV NODE_ENV=production
EXPOSE 5000

# Run as the non-root "node" user for security
RUN mkdir -p uploads && chown -R node:node /app
USER node

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "src/server.js"]
