# Multi-stage Dockerfile for Ponder Indexer

# Stage 1: Dependencies
FROM node:20-slim AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Stage 2: Build
FROM node:20-slim AS builder

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

# Skip codegen during build - will run at startup
# This avoids rollup architecture-specific issues
# Build TypeScript (if needed)
# Skip type checking as Ponder handles its own types internally

# Stage 3: Runtime
FROM node:20-slim AS runtime

# Install dumb-init for proper signal handling and pnpm
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user
RUN groupadd -g 1001 ponder && \
    useradd -m -u 1001 -g ponder ponder

# Set working directory
WORKDIR /app

# Copy package files first
COPY --chown=ponder:ponder package.json pnpm-lock.yaml ./

# Install ALL dependencies directly in runtime (ensures correct architecture binaries)
RUN pnpm install --frozen-lockfile

# Copy source files needed for codegen
COPY --chown=ponder:ponder ponder.config.ts ponder.schema.ts ponder-env.d.ts* ./
COPY --chown=ponder:ponder src/index.ts ./src/
COPY --chown=ponder:ponder src/api ./src/api
COPY --chown=ponder:ponder abis ./abis

# Run codegen once during build (as root for file permissions)
RUN pnpm run codegen

# Clean up dev dependencies to reduce image size (optional)
RUN pnpm prune --prod

# Create directories for runtime and set ownership
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

# Start the indexer (codegen already ran during build)
CMD ["pnpm", "run", "start", "--log-level", "info"]
