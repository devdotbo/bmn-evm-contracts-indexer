# 🌉 BMN EVM Contracts Indexer

## What is this?

The BMN Indexer is a high-performance blockchain data indexer that tracks the Bridge Me Not (BMN) atomic swap protocol across Base and Etherlink networks. It monitors smart contract events in real-time and stores them in a queryable database, making cross-chain swap data easily accessible through a GraphQL API.

## Key Features

### 🚀 Real-time Multi-chain Indexing
- **Simultaneous tracking** of Base (Chain ID: 8453) and Etherlink (Chain ID: 42793)
- **WebSocket connections** for instant event detection
- **Automatic failover** to HTTP when WebSocket is unavailable
- **Cross-chain correlation** using hashlock to link source and destination escrows

### 📊 Comprehensive Event Tracking
The indexer captures all critical protocol events:
- **Escrow Creation**: When users initiate atomic swaps
- **Withdrawals**: Successful swap completions with secret reveals
- **Cancellations**: Failed or cancelled swaps
- **Fund Rescues**: Emergency fund recovery operations

### 🔍 Powerful Query API
Access indexed data through GraphQL:
```graphql
# Find all active swaps for a user
query UserSwaps($address: String!) {
  atomicSwaps(where: { srcMaker: $address, status: "active" }) {
    id
    srcChainId
    dstChainId
    srcAmount
    dstAmount
    createdAt
  }
}
```

### 📈 Built-in Analytics
Track protocol metrics per chain:
- Total escrows created (source & destination)
- Total withdrawal volume
- Number of cancellations
- Active swap statistics

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     BMN Protocol Events                      │
├──────────────────────────┬──────────────────────────────────┤
│      Base Network        │         Etherlink Network        │
│  CrossChainEscrowFactory │    CrossChainEscrowFactory       │
└──────────────┬───────────┴───────────────┬──────────────────┘
               │                           │
               │      WebSocket/RPC        │
               └────────────┬──────────────┘
                            │
                    ┌───────┴────────┐
                    │ Ponder Engine  │
                    │                │
                    │ • Event Parser │
                    │ • State Manager│
                    │ • GraphQL API │
                    └───────┬────────┘
                            │
                    ┌───────┴────────┐
                    │  PostgreSQL    │
                    │                │
                    │ Indexed Data:  │
                    │ • SrcEscrow    │
                    │ • DstEscrow    │
                    │ • AtomicSwap   │
                    │ • Statistics   │
                    └────────────────┘
```

## Getting Started

### Quick Setup (5 minutes)

1. **Clone and Configure**
   ```bash
   git clone <repository-url>
   cd bmn-evm-contracts-indexer
   cp .env.example .env.local
   ```

2. **Add Your RPC URLs** to `.env.local`:
   ```env
   PONDER_RPC_URL_8453=https://your-base-rpc
   PONDER_WS_URL_8453=wss://your-base-websocket
   PONDER_RPC_URL_42793=https://your-etherlink-rpc
   PONDER_WS_URL_42793=wss://your-etherlink-websocket
   ```

3. **Start Indexing**
   ```bash
   # With Docker (recommended)
   make docker-up

   # Or locally
   pnpm install
   make dev
   ```

4. **Query Your Data**
   - GraphQL Playground: http://localhost:42069/graphql
   - Health Check: http://localhost:42069/health

## Database Schema

### Core Tables

**AtomicSwap** - The main cross-chain swap record
- Links source and destination escrows
- Tracks swap lifecycle (created → completed/cancelled)
- Stores amounts, addresses, and timing data

**SrcEscrow** - Source chain escrow details
- Sender address and amounts
- Order hash and hashlock
- Timelock parameters

**DstEscrow** - Destination chain escrow details
- Recipient address
- Expected amounts
- Linked via hashlock

**ChainStatistics** - Real-time protocol metrics
- Volume statistics
- Transaction counts
- Updated with each event

## Advanced Usage

### Custom Queries

The GraphQL API supports complex queries with filtering, sorting, and pagination:

```graphql
# Get recent high-value swaps
query RecentLargeSwaps {
  atomicSwaps(
    where: { srcAmount_gt: "1000000000000000000" }
    orderBy: createdAt
    orderDirection: desc
    limit: 10
  ) {
    id
    srcMaker
    dstTaker
    srcAmount
    dstAmount
    status
    createdAt
  }
}
```

### Performance Tuning

For high-volume environments, adjust in `ponder.config.ts`:
```typescript
etherlink: {
  maxHistoricalBlockRange: 2000,  // Blocks per query
  syncBatchSize: 1000,            // Batch size for sync
}
```

### Running Debug Mode

For troubleshooting:
```bash
./run-debug.sh  # Debug logging
./run-trace.sh  # Maximum verbosity
```

## Deployment Options

### Docker Production
```bash
docker-compose -f docker-compose.yml up -d
```

### Kubernetes
Use the provided Helm chart (coming soon) for K8s deployments

### Railway/Vercel
Deploy with one click using the deployment button

## API Examples

### Get Swap Status
```typescript
const query = `
  query GetSwap($id: String!) {
    atomicSwap(id: $id) {
      status
      secret
      completedAt
    }
  }
`;

const response = await fetch('http://localhost:42069/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { id: swapId } })
});
```

### Subscribe to Events (Coming Soon)
```typescript
subscription SwapUpdates {
  atomicSwapUpdated(status: "completed") {
    id
    secret
    completedAt
  }
}
```

## Contributing

We welcome contributions! Areas where you can help:
- Add support for new chains
- Improve query performance
- Add real-time subscriptions
- Create data visualization dashboards

## Resources

- **Ponder Documentation**: https://ponder.sh/docs
- **BMN Protocol**: https://github.com/bridge-me-not
- **Support**: Open an issue on GitHub

---

Built with [Ponder](https://ponder.sh) - The blockchain indexing framework