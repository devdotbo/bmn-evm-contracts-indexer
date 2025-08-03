# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BMN EVM Contracts Indexer is a Ponder-based indexer for the Bridge Me Not (BMN) atomic swap protocol, tracking cross-chain escrow operations across Base (8453) and Etherlink (42793) networks.

## Essential Commands

### Development
```bash
make dev          # Start dev environment with database and hot reloading
make clean        # Clean build artifacts and .ponder directory
make setup        # Initial project setup (env, install deps, codegen)
make reset        # Reset database and clean artifacts
pnpm run dev      # Start indexer in development mode (without database setup)
pnpm run clean    # Clean build artifacts and .ponder directory
```

### Production
```bash
make docker-up    # Start all services with Docker Compose
make docker-down  # Stop all Docker Compose services
make docker-logs  # View Docker Compose logs
make start        # Start production indexer
make serve        # Start GraphQL server separately
pnpm run start    # Start production indexer
pnpm run serve    # Start GraphQL server separately
```

### Code Quality
```bash
make lint         # Run ESLint
make lint-fix     # Run ESLint with auto-fix
make typecheck    # Run TypeScript type checking
make format       # Format code with Prettier
make format-check # Check code formatting without changes
pnpm run lint     # Run ESLint
pnpm run typecheck # Run TypeScript type checking
pnpm run format   # Format code with Prettier
```

### Database Operations
```bash
make db           # Access Ponder database CLI
make codegen      # Generate TypeScript types from schema
make db-up        # Start PostgreSQL and PgAdmin
make db-down      # Stop PostgreSQL and PgAdmin
make psql         # Connect to PostgreSQL
pnpm run db       # Access Ponder database CLI
pnpm run codegen  # Generate TypeScript types from schema
```

### PostgreSQL Standalone Operations
```bash
make postgres-up      # Start PostgreSQL and PgAdmin using standalone compose file
make postgres-down    # Stop PostgreSQL and PgAdmin standalone services
make postgres-restart # Restart PostgreSQL and PgAdmin standalone services
make postgres-status  # Check PostgreSQL services status
make postgres-logs    # View PostgreSQL services logs
make postgres-backup  # Create PostgreSQL database backup
make postgres-psql    # Connect to PostgreSQL console (standalone)
make postgres-clean   # Clean all PostgreSQL data and volumes
```

### Utility Commands
```bash
make install      # Install dependencies with pnpm
make build        # Build the project
make test         # Run tests (if available)
make deps-update  # Update dependencies
make deps-check   # Check for outdated dependencies
make env-setup    # Copy .env.example to .env if not exists
make logs         # View indexer logs (tail)
make status       # Check service status
make help         # Show all available commands
```

## Architecture Overview

### Core Components

1. **ponder.config.ts**: Multi-chain configuration
   - Configures Base (8453) and Etherlink (42793) networks
   - Uses WebSocket with HTTP fallback for real-time updates
   - Tracks CrossChainEscrowFactory contract at `0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1`

2. **ponder.schema.ts**: Database schema defining tables:
   - `SrcEscrow`: Source chain escrows
   - `DstEscrow`: Destination chain escrows
   - `EscrowWithdrawal`: Successful withdrawals
   - `EscrowCancellation`: Cancelled escrows
   - `FundsRescued`: Rescued funds events
   - `AtomicSwap`: Cross-chain swap state aggregation
   - `ChainStatistics`: Per-chain protocol analytics

3. **src/index.ts**: Event indexing logic
   - Handles factory events: `SrcEscrowCreated`, `DstEscrowCreated`
   - Handles escrow events: `EscrowWithdrawal`, `EscrowCancelled`, `FundsRescued`
   - Maintains cross-chain state in AtomicSwap table
   - Updates real-time statistics

### Docker Architecture

The project provides a comprehensive multi-service Docker setup:

1. **docker-compose.yml**: Main orchestration file containing:
   - **PostgreSQL**: Database service with health checks and initialization scripts
   - **PgAdmin**: Web-based database management interface
   - **Indexer**: Ponder indexer service with environment configuration
   - Resource limits and logging configuration
   - Named volumes for data persistence
   - Dedicated network for service communication

2. **docker-compose.postgres.yml**: Standalone PostgreSQL setup with:
   - Advanced performance tuning parameters
   - Resource limits and reservations
   - Separate volumes for data, logs, and backups
   - Enhanced security options
   - Custom network configuration with subnet allocation

### Key Implementation Details

- **Dynamic Escrow Tracking**: Escrow addresses are dynamically created via CREATE2
- **Address Decoding**: Addresses are packed in uint256 and decoded using bitwise operations (src/index.ts:14-18)
- **Cross-Chain Correlation**: Uses hashlock to link source and destination escrows
- **Event Flow**: Factory creates escrows → Events update status → Statistics aggregate data

### Environment Configuration

Required environment variables (copy .env.example to .env):

**Network Configuration:**
- `PONDER_RPC_URL_8453`: Base network RPC endpoint
- `PONDER_RPC_URL_42793`: Etherlink network RPC endpoint
- `PONDER_WS_URL_8453`: Base WebSocket endpoint (optional)
- `PONDER_WS_URL_42793`: Etherlink WebSocket endpoint (optional)
- `BASE_START_BLOCK`: Base network start block
- `ETHERLINK_START_BLOCK`: Etherlink network start block

**PostgreSQL Configuration:**
- `POSTGRES_USER`: Database user (default: ponder)
- `POSTGRES_PASSWORD`: Database password (default: ponder123)
- `POSTGRES_DB`: Database name (default: bmn_indexer)
- `POSTGRES_PORT`: Database port (default: 5432)
- `DATABASE_URL`: Full database connection string
- `DATABASE_SCHEMA`: Database schema (default: public)

**PgAdmin Configuration:**
- `PGADMIN_EMAIL`: Admin email (default: admin@bmn.local)
- `PGADMIN_PASSWORD`: Admin password (default: admin123)
- `PGADMIN_PORT`: PgAdmin port (default: 5433)

**Application Configuration:**
- `NODE_ENV`: Environment mode (development/production)
- `PORT`: GraphQL server port (default: 42069)
- `PONDER_LOG_LEVEL`: Logging level (default: info)
- `PONDER_TELEMETRY_DISABLED`: Disable telemetry (default: false)

### API Endpoints

- GraphQL: `http://localhost:42069/graphql`
- Health Check: `http://localhost:42069/health`
- Ready Check: `http://localhost:42069/ready`

## Development Workflow

1. **Adding New Chains**: Update ponder.config.ts with new network configuration
2. **Schema Changes**: Edit ponder.schema.ts → Run `pnpm run codegen`
3. **New Event Handlers**: Add handlers in src/index.ts following existing patterns
4. **Testing Changes**: Use `make dev` for local development with hot reloading

## Docker Deployment

The project includes production-ready Docker configurations:

### Quick Start
```bash
# Start all services (PostgreSQL, PgAdmin, Indexer)
make docker-up

# View logs
make docker-logs

# Stop all services
make docker-down
```

### Standalone PostgreSQL
For development scenarios where you only need the database:
```bash
# Start PostgreSQL and PgAdmin
make postgres-up

# Check status
make postgres-status

# Create backup
make postgres-backup

# Connect to database
make postgres-psql
```

### Container Details
- **Indexer**: Runs on port 42069 with health checks and auto-restart
- **PostgreSQL**: Port 5432 with performance tuning and data persistence
- **PgAdmin**: Port 5433 with pre-configured server connection
- All services use resource limits and dedicated networking

## Scripts and Utilities

The `scripts/` directory contains automation tools:

### postgres-manager.sh
Comprehensive PostgreSQL management script with commands:
- `start`: Launch PostgreSQL and PgAdmin containers
- `stop`: Stop running containers
- `restart`: Restart services
- `status`: Check service health
- `logs`: View container logs
- `backup`: Create database backup
- `psql`: Connect to PostgreSQL console
- `clean`: Remove all data and volumes

### Database Initialization
- `init-db/01-init.sql`: Database initialization script
- `pgadmin-servers.json`: Pre-configured PgAdmin server connections
- `pgadmin-preferences.json`: PgAdmin UI preferences

## Development Tools

### Makefile
The project includes a comprehensive Makefile that:
- Provides consistent command interface across environments
- Includes dependency checks for required tools
- Offers helpful command descriptions via `make help`
- Groups related commands logically (dev, production, database, utilities)
- Handles complex multi-step operations (e.g., `make reset`, `make setup`)

### Best Practices
1. **Initial Setup**: Run `make setup` to configure environment and dependencies
2. **Development**: Use `make dev` for hot-reloading development
3. **Database Management**: Prefer Make commands for consistent database operations
4. **Docker Deployment**: Use `make docker-*` commands for production deployment
5. **Code Quality**: Run `make lint-fix` and `make format` before committing

## Important Notes

- The indexer uses Ponder v0.12.0 framework
- WebSocket connections provide real-time updates with HTTP fallback
- CREATE2 address calculation needs proper implementation (currently placeholder at src/index.ts:79)
- Statistics are maintained per chain and updated in real-time
- The project includes comprehensive Docker Compose setup for production deployment

## Project Status and Roadmap

For detailed information about the current project status, completed features, limitations, and next steps, see:
- **[PROJECT_STATUS.md](docs/PROJECT_STATUS.md)**: Comprehensive status report including:
  - Current implementation state
  - Completed features and infrastructure
  - Known limitations and their impact
  - Prioritized next steps with technical details
  - Performance considerations and benchmarks
  - Security recommendations
  - Future enhancement roadmap

This document is essential for understanding what work remains and the priority of upcoming tasks.

## Git Commit Strategy

When committing files individually with the git-workflow subagent:

1. **Pre-commit Review**: Check if any files should be added to .gitignore
2. **Individual Commits**: Commit files/groups separately with descriptive messages
3. **Random Sleep Timer**: Add 2-7 second delays between commits using `sleep $((2 + RANDOM % 6))`
4. **Logical Grouping**: Group related files (e.g., ABIs together, config files separately)
5. **Commit Message Format**: Use clear, descriptive messages that explain the purpose and functionality

Example workflow:
```bash
# Review and update .gitignore if needed
git add .gitignore && git commit -m "chore: update .gitignore with comprehensive patterns"
sleep $((2 + RANDOM % 6))

# Commit configuration files
git add .env.example && git commit -m "feat: add environment configuration template"
sleep $((2 + RANDOM % 6))

# Commit related files as groups
git add abis/ && git commit -m "feat: add contract ABIs for escrow indexing"
```