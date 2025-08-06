# BMN EVM Contracts Indexer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.14-brightgreen)](https://nodejs.org)
[![Framework](https://img.shields.io/badge/framework-Ponder%20v0.12.0-blue)](https://ponder.sh)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com)

A high-performance blockchain indexer for the Bridge Me Not (BMN) atomic swap protocol, tracking cross-chain escrow operations and limit orders across Base and Optimism networks.

## 🚀 Features

- **Multi-Protocol Support**: Indexes both CrossChainEscrowFactory and SimpleLimitOrderProtocol
- **Real-time Indexing**: WebSocket connections with HTTP fallback for instant event processing
- **Cross-chain Support**: Simultaneous indexing of Base (8453) and Optimism (10) networks
- **GraphQL API**: Query indexed data through a powerful GraphQL interface
- **SQL over HTTP**: Direct SQL queries via @ponder/client for advanced use cases
- **Comprehensive Event Tracking**: 
  - Escrow creation, withdrawals, and cancellations
  - Limit order fills and cancellations
  - BMN token transfers and approvals
  - Bit invalidation and epoch management
- **Cross-chain Correlation**: Automatic linking of source and destination escrows via hashlock
- **Analytics**: Built-in chain statistics and protocol metrics
- **Docker Ready**: Complete containerization with Docker Compose
- **PostgreSQL Backend**: Robust data storage with automatic migrations

## 📋 Prerequisites

- **Node.js**: >= 18.14
- **pnpm**: >= 8.0 (recommended) or npm
- **Docker & Docker Compose**: For containerized deployment
- **PostgreSQL**: 16+ (if running locally without Docker)
- **Ankr API Key**: For Base and Optimism RPC access

## 🏗️ Architecture Overview

### Indexed Contracts

#### CrossChainEscrowFactory
- **Address**: `0xB916C3edbFe574fFCBa688A6B92F72106479bD6c`
- **Networks**: Base (33809842), Optimism (139404873)
- **Events**: SrcEscrowCreated, DstEscrowCreated

#### SimpleLimitOrderProtocol
- **Base**: `0x1c1A74b677A28ff92f4AbF874b3Aa6dE864D3f06` (Block: 33852257)
- **Optimism**: `0x44716439C19c2E8BD6E1bCB5556ed4C31dA8cDc7` (Block: 139447565)
- **Events**: OrderFilled, OrderCancelled, BitInvalidatorUpdated, EpochIncreased

#### BMN Token (ERC20)
- **Address**: `0x8287CD2aC7E227D9D927F998EB600a0683a832A1`
- **Base Start**: Block 33717297
- **Optimism Start**: Block 139404696
- **Events**: Transfer, Approval

### Database Schema

The indexer maintains 16 tables optimized for resolver queries:

**Core Escrow Tables:**
- `src_escrow` - Source chain escrow records
- `dst_escrow` - Destination chain escrow records
- `escrow_withdrawal` - Successful withdrawals
- `escrow_cancellation` - Cancellation records
- `funds_rescued` - Emergency fund recovery
- `atomic_swap` - Aggregated cross-chain swap state

**Limit Order Tables:**
- `limit_order` - Order state tracking for resolvers
- `order_filled` - Fill events with remaining amounts
- `order_cancelled` - Cancellation tracking
- `bit_invalidator_updated` - Bit invalidation state
- `epoch_increased` - Epoch management for order series
- `limit_order_statistics` - Protocol analytics

**BMN Token Tables:**
- `bmn_transfer` - All token transfers
- `bmn_approval` - Current approval states
- `bmn_token_holder` - Holder balances and statistics

**Analytics:**
- `chain_statistics` - Real-time protocol metrics per chain

## 🏃 Quick Start

### Using Make Commands (Recommended)

```bash
# Initial setup
make setup        # Configure environment and install dependencies
make dev          # Start development environment with hot reloading

# Database operations
make db-up        # Start PostgreSQL and PgAdmin
make codegen      # Generate TypeScript types from schema

# Code quality
make lint-fix     # Run ESLint with auto-fix
make format       # Format code with Prettier
```

### Manual Setup

1. **Clone and configure**
```bash
git clone <repository-url>
cd bmn-evm-contracts-indexer
cp .env.example .env
```

2. **Set required environment variables**
```env
ANKR_API_KEY=your_ankr_api_key
DATABASE_URL=postgresql://ponder:ponder123@localhost:5432/bmn_indexer
```

3. **Install and run**
```bash
pnpm install
pnpm run codegen
pnpm ponder dev
```

## 📡 API Access

### GraphQL Endpoint
- **URL**: `http://localhost:42069/graphql`
- **Playground**: Available at the same URL in browser

### SQL over HTTP
- **URL**: `http://localhost:42069/sql/*`
- **Documentation**: See `docs/SQL_OVER_HTTP.md`
- **Test Script**: `deno run --node-modules-dir=auto --allow-net --allow-env --allow-read scripts/test-sql-deno.ts`

### Health Endpoints
- **Health Check**: `http://localhost:42069/health`
- **Ready Check**: `http://localhost:42069/ready`

## 🔍 Example Queries

### GraphQL: Get Active Limit Orders
```graphql
query GetActiveOrders {
  limitOrders(where: { status: "active" }) {
    id
    orderHash
    maker
    makerAsset
    takerAsset
    makingAmount
    takingAmount
    remainingAmount
    status
  }
}
```

### GraphQL: Track Order Fills
```graphql
query GetOrderFills($orderHash: String!) {
  orderFilleds(where: { orderHash: $orderHash }) {
    id
    remainingAmount
    taker
    blockNumber
    transactionHash
  }
}
```

### SQL: Get Cross-Chain Swap Status
```sql
SELECT 
  as.order_hash,
  as.src_chain_id,
  as.dst_chain_id,
  as.status,
  as.src_escrow_address,
  as.dst_escrow_address
FROM atomic_swap as
WHERE as.hashlock = $1
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANKR_API_KEY` | Ankr API key for RPC access | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `BASE_START_BLOCK` | Base indexing start block | No |
| `OPTIMISM_START_BLOCK` | Optimism indexing start block | No |
| `POSTGRES_USER` | Database user | Yes |
| `POSTGRES_PASSWORD` | Database password | Yes |
| `POSTGRES_DB` | Database name | Yes |
| `NODE_ENV` | Environment mode | No |
| `PONDER_LOG_LEVEL` | Logging level (info/debug) | No |

## 🛠️ Development

### Adding New Events

1. Update contract ABI in `abis/`
2. Add event handler in `src/index.ts`:
```typescript
ponder.on("ContractName:EventName", async ({ event, context }) => {
  // Event handling logic
});
```
3. Update schema if needed in `ponder.schema.ts`
4. Run `pnpm run codegen` to generate types

### Testing
```bash
# Start development environment
make dev

# In another terminal, run test queries
deno run --node-modules-dir=auto --allow-net --allow-env --allow-read scripts/test-sql-deno.ts
```

## 🚀 Production Deployment

### Docker Deployment
```bash
# Build and start all services
make docker-up

# Monitor logs
make docker-logs

# Stop services
make docker-down
```

### Standalone PostgreSQL
```bash
# Start PostgreSQL and PgAdmin only
make postgres-up

# Check status
make postgres-status

# Create backup
make postgres-backup
```

## 🔧 Troubleshooting

### Common Issues

**RPC Connection Errors**
- Verify ANKR_API_KEY is set correctly
- Check network connectivity
- Consider using fallback RPC endpoints

**Database Connection Failed**
```bash
make db-up  # Ensure PostgreSQL is running
```

**Type Errors After Schema Changes**
```bash
pnpm run codegen  # Regenerate types
```

**Indexing Performance**
- Adjust `maxHistoricalBlockRange` in ponder.config.ts
- Enable debug logging: `PONDER_LOG_LEVEL=debug`

## 📚 Documentation

- **Project Status**: `docs/PROJECT_STATUS.md` - Current implementation state
- **SQL over HTTP Guide**: `docs/SQL_OVER_HTTP.md` - Advanced query examples
- **Event Implementation**: `docs/ABI_EVENTS_IMPLEMENTATION_STATUS.md`
- **Architecture Details**: See inline documentation in source files

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run quality checks:
   ```bash
   make lint-fix
   make format
   ```
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [Ponder](https://ponder.sh) - Indexing framework
- [Viem](https://viem.sh) - Ethereum interface
- [1inch](https://1inch.io) - Limit order protocol inspiration
- Bridge Me Not Protocol team

---

Built for the Bridge Me Not ecosystem - enabling trustless cross-chain atomic swaps