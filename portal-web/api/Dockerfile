# Use Node.js 20 LTS (Alpine for smaller image size)
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S grifo -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs && chown -R grifo:nodejs logs

# Remove development files
RUN rm -rf .git .gitignore README.md docs/ tests/ *.md

# Set proper permissions
RUN chown -R grifo:nodejs /app
USER grifo

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/server.js"]

# Multi-stage build for development
FROM base AS development

# Switch back to root to install dev dependencies
USER root

# Install all dependencies (including dev)
RUN npm ci && npm cache clean --force

# Install nodemon globally for development
RUN npm install -g nodemon

# Switch back to grifo user
USER grifo

# Override CMD for development
CMD ["npm", "run", "dev"]

# Production stage (default)
FROM base AS production

# Set NODE_ENV
ENV NODE_ENV=production

# Optimize Node.js for production
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Labels for better container management
LABEL maintainer="Grifo API Team"
LABEL version="1.0.0"
LABEL description="Grifo API - Sistema de Gestão de Vistorias"

# Final command
CMD ["node", "src/server.js"]