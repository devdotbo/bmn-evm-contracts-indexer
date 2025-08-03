# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BMN EVM Contracts Indexer is a Ponder-based indexer for the Bridge Me Not (BMN) atomic swap protocol, tracking cross-chain escrow operations across Base (8453) and Etherlink (42793) networks.

## Essential Commands

### Development
```bash
make dev          # Start dev environment with database and hot reloading
npm run dev       # Start indexer in development mode (without database setup)
npm run clean     # Clean build artifacts and .ponder directory
```

### Production
```bash
make docker-up    # Start all services with Docker Compose
npm run start     # Start production indexer
npm run serve     # Start GraphQL server separately
```

### Code Quality
```bash
npm run lint      # Run ESLint
npm run typecheck # Run TypeScript type checking
npm run format    # Format code with Prettier
```

### Database Operations
```bash
npm run db        # Access Ponder database CLI
npm run codegen   # Generate TypeScript types from schema
make db-up        # Start PostgreSQL and PgAdmin
make psql         # Connect to PostgreSQL
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

### Key Implementation Details

- **Dynamic Escrow Tracking**: Escrow addresses are dynamically created via CREATE2
- **Address Decoding**: Addresses are packed in uint256 and decoded using bitwise operations (src/index.ts:14-18)
- **Cross-Chain Correlation**: Uses hashlock to link source and destination escrows
- **Event Flow**: Factory creates escrows → Events update status → Statistics aggregate data

### Environment Configuration

Required environment variables (copy .env.example to .env):
- `PONDER_RPC_URL_8453`: Base network RPC endpoint
- `PONDER_RPC_URL_42793`: Etherlink network RPC endpoint
- `PONDER_WS_URL_8453`: Base WebSocket endpoint (optional)
- `PONDER_WS_URL_42793`: Etherlink WebSocket endpoint (optional)
- `BASE_START_BLOCK`: Base network start block
- `ETHERLINK_START_BLOCK`: Etherlink network start block

### API Endpoints

- GraphQL: `http://localhost:42069/graphql`
- Health Check: `http://localhost:42069/health`
- Ready Check: `http://localhost:42069/ready`

## Development Workflow

1. **Adding New Chains**: Update ponder.config.ts with new network configuration
2. **Schema Changes**: Edit ponder.schema.ts → Run `npm run codegen`
3. **New Event Handlers**: Add handlers in src/index.ts following existing patterns
4. **Testing Changes**: Use `make dev` for local development with hot reloading

## Important Notes

- The indexer uses Ponder v0.12.0 framework
- WebSocket connections provide real-time updates with HTTP fallback
- CREATE2 address calculation needs proper implementation (currently placeholder at src/index.ts:79)
- Statistics are maintained per chain and updated in real-time
- The project includes comprehensive Docker Compose setup for production deployment

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