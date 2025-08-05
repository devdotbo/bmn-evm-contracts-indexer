# Multi-stage Dockerfile for Ponder Indexer
ARG NODE_VERSION=20-alpine

# Stage 1: Dependencies
FROM node:${NODE_VERSION} AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Stage 2: Build
FROM node:${NODE_VERSION} AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate types from schema
RUN pnpm run codegen

# Build TypeScript (if needed)
# Skip type checking as Ponder handles its own types internally

# Stage 3: Runtime
FROM node:${NODE_VERSION} AS runtime

# Install dumb-init for proper signal handling and pnpm
RUN apk add --no-cache dumb-init && \
    corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN addgroup -g 1001 -S ponder && \
    adduser -S ponder -u 1001 -G ponder

# Set working directory
WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps --chown=ponder:ponder /app/node_modules ./node_modules

# Copy package files
COPY --chown=ponder:ponder package.json pnpm-lock.yaml ./

# Copy built application and generated files (if they exist)
# The generated directory may not exist in all cases
COPY --from=builder --chown=ponder:ponder /app/generated* ./

# Copy source files
COPY --chown=ponder:ponder ponder.config.ts ponder.schema.ts ponder-env.d.ts* ./
COPY --chown=ponder:ponder src/index.ts ./src/
COPY --chown=ponder:ponder src/api ./src/api
COPY --chown=ponder:ponder abis ./abis

# Create directories for runtime
RUN mkdir -p /app/.ponder && \
    chown -R ponder:ponder /app

# Switch to non-root user
USER ponder

# Expose GraphQL port
EXPOSE 42069

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://localhost:42069/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the indexer using pnpm
CMD ["pnpm", "run", "start", "--log-level", "info"]
