# BMN EVM Contracts Indexer Setup Guide

This guide provides comprehensive instructions for setting up and running the Bridge Me Not (BMN) EVM contracts indexer using Ponder, an open-source framework for custom Ethereum indexing.

## Quick Start

```bash
# 1. Initial setup
make setup

# 2. Update .env with your RPC URLs
nano .env

# 3. Start development environment
make dev

# For production with Docker:
make docker-up
```

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Multi-Chain Configuration](#multi-chain-configuration)
4. [Contract Configuration](#contract-configuration)
5. [Event Indexing Patterns](#event-indexing-patterns)
6. [Database Schema Setup](#database-schema-setup)
7. [RPC Configuration](#rpc-configuration)
8. [Environment Variables](#environment-variables)
9. [Running the Indexer](#running-the-indexer)
10. [Production Deployment](#production-deployment)
11. [Monitoring and Maintenance](#monitoring-and-maintenance)
12. [Best Practices](#best-practices)

## Prerequisites

- Node.js v18+ and pnpm installed
- PostgreSQL database (for production)
- RPC endpoints for each chain you want to index
- Contract ABIs for the BMN contracts

## Initial Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Configure your database:**
   - For development: SQLite is used by default
   - For production: PostgreSQL is required (see Docker Compose setup below)

### Quick Start with Docker Compose

For a complete development environment with PostgreSQL:

```bash
# Start PostgreSQL and PgAdmin
docker-compose up -d postgres pgadmin

# Wait for PostgreSQL to be ready
docker-compose exec postgres pg_isready -U ponder -d bmn_indexer

# View logs
docker-compose logs -f postgres
```

Access PgAdmin at `http://localhost:5433` with credentials from `.env`.

## Multi-Chain Configuration

Configure multiple chains in `ponder.config.ts`:

```typescript
import { createConfig } from "@ponder/core";
import { http } from "viem";

export default createConfig({
  chains: {
    // Ethereum Mainnet
    mainnet: {
      id: 1,
      rpc: process.env.PONDER_RPC_URL_1,
      // Optional: Add WebSocket endpoint for real-time updates
      transport: http(process.env.PONDER_RPC_URL_1, {
        batch: true,
        fetchOptions: {
          headers: {
            // Add any required headers for your RPC provider
          },
        },
      }),
    },
    // Optimism
    optimism: {
      id: 10,
      rpc: [
        // Multiple RPC endpoints for redundancy
        process.env.PONDER_RPC_URL_10,
        "https://optimism.llamarpc.com",
      ],
    },
    // Arbitrum
    arbitrum: {
      id: 42161,
      rpc: process.env.PONDER_RPC_URL_42161,
    },
    // Base
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453,
    },
    // Polygon
    polygon: {
      id: 137,
      rpc: process.env.PONDER_RPC_URL_137,
    },
  },
  // Additional configuration...
});
```

## Contract Configuration

Configure BMN contracts for multi-chain indexing:

```typescript
import { createConfig, mergeAbis } from "@ponder/core";
import { BridgeContractAbi } from "./abis/BridgeContract";
import { TokenContractAbi } from "./abis/TokenContract";

export default createConfig({
  contracts: {
    BridgeContract: {
      abi: BridgeContractAbi,
      // Chain-specific configuration
      chain: {
        mainnet: {
          address: "0x1234567890123456789012345678901234567890",
          startBlock: 18000000, // Contract deployment block
        },
        optimism: {
          address: "0x0987654321098765432109876543210987654321",
          startBlock: 100000000,
        },
        arbitrum: {
          address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          startBlock: 150000000,
        },
      },
      // Optional: Filter specific events
      filter: {
        event: ["BridgeInitiated", "BridgeCompleted", "BridgeFailed"],
      },
    },
    TokenContract: {
      abi: TokenContractAbi,
      // Multiple addresses on the same chain
      address: [
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ],
      chain: "mainnet",
      startBlock: 17500000,
    },
    // Factory pattern for dynamic contract discovery
    TokenFactory: {
      abi: TokenFactoryAbi,
      address: "0xcccccccccccccccccccccccccccccccccccccccc",
      chain: "mainnet",
      startBlock: 17000000,
      // Index all contracts created by this factory
      factory: {
        event: "TokenCreated",
        parameter: "tokenAddress",
      },
    },
  },
});
```

## Event Indexing Patterns

Create event handlers in `src/index.ts`:

```typescript
import { ponder } from "@/generated";

// Basic event indexing
ponder.on("BridgeContract:BridgeInitiated", async ({ event, context }) => {
  const { user, tokenAddress, amount, destinationChain, nonce } = event.args;
  
  await context.db.BridgeTransaction.create({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    data: {
      user,
      tokenAddress,
      amount,
      sourceChain: context.chain.id,
      destinationChain,
      nonce,
      status: "initiated",
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
      transactionHash: event.transaction.hash,
    },
  });
});

// Multi-chain event correlation
ponder.on("BridgeContract:BridgeCompleted", async ({ event, context }) => {
  const { nonce, user, amount } = event.args;
  
  // Update the bridge transaction status
  await context.db.BridgeTransaction.update({
    id: nonce,
    data: {
      status: "completed",
      completedAt: BigInt(event.block.timestamp),
      completedChain: context.chain.id,
      completedTxHash: event.transaction.hash,
    },
  });
  
  // Update user statistics
  await context.db.UserStats.upsert({
    id: user,
    create: {
      totalBridged: amount,
      bridgeCount: 1n,
      lastBridgeTimestamp: BigInt(event.block.timestamp),
    },
    update: ({ current }) => ({
      totalBridged: current.totalBridged + amount,
      bridgeCount: current.bridgeCount + 1n,
      lastBridgeTimestamp: BigInt(event.block.timestamp),
    }),
  });
});

// Complex event handling with call traces
ponder.on("BridgeContract:callTrace", async ({ trace, context }) => {
  if (trace.functionName === "emergencyWithdraw") {
    await context.db.EmergencyAction.create({
      id: trace.transaction.hash,
      data: {
        user: trace.from,
        timestamp: BigInt(trace.block.timestamp),
        reason: trace.args.reason,
      },
    });
  }
});
```

## Database Schema Setup

Define your schema in `ponder.schema.ts`:

```typescript
import { onchainTable } from "@ponder/core";

export const BridgeTransaction = onchainTable("bridge_transaction", (t) => ({
  id: t.text().primaryKey(),
  user: t.hex().notNull(),
  tokenAddress: t.hex().notNull(),
  amount: t.bigint().notNull(),
  sourceChain: t.integer().notNull(),
  destinationChain: t.integer().notNull(),
  nonce: t.hex().notNull(),
  status: t.text().notNull(), // "initiated", "completed", "failed"
  timestamp: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  transactionHash: t.hex().notNull(),
  completedAt: t.bigint(),
  completedChain: t.integer(),
  completedTxHash: t.hex(),
  failureReason: t.text(),
}), 
(table) => ({
  userIndex: t.index("user_idx").on(table.user),
  nonceIndex: t.index("nonce_idx").on(table.nonce),
  statusIndex: t.index("status_idx").on(table.status),
  timestampIndex: t.index("timestamp_idx").on(table.timestamp),
}));

export const UserStats = onchainTable("user_stats", (t) => ({
  id: t.hex().primaryKey(), // user address
  totalBridged: t.bigint().notNull(),
  bridgeCount: t.bigint().notNull(),
  lastBridgeTimestamp: t.bigint().notNull(),
  totalFeePaid: t.bigint().default(0n),
}));

export const TokenMetrics = onchainTable("token_metrics", (t) => ({
  id: t.text().primaryKey(), // tokenAddress-chainId
  tokenAddress: t.hex().notNull(),
  chainId: t.integer().notNull(),
  totalVolume: t.bigint().notNull(),
  transactionCount: t.bigint().notNull(),
  uniqueUsers: t.integer().notNull(),
  lastActivityTimestamp: t.bigint().notNull(),
}));

export const ChainMetrics = onchainTable("chain_metrics", (t) => ({
  id: t.integer().primaryKey(), // chainId
  totalInbound: t.bigint().notNull(),
  totalOutbound: t.bigint().notNull(),
  transactionCount: t.bigint().notNull(),
  lastBlockIndexed: t.bigint().notNull(),
}));
```

## RPC Configuration

### Basic RPC Setup

```bash
# .env file
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PONDER_RPC_URL_10=https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PONDER_RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PONDER_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PONDER_RPC_URL_137=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

### Advanced RPC Configuration with Load Balancing

Based on research, Ponder works exceptionally well with eRPC for cost-effective multi-chain indexing:

```typescript
// Using eRPC for load balancing and failover
chains: {
  mainnet: {
    id: 1,
    rpc: [
      process.env.PONDER_RPC_URL_1_PRIMARY,
      process.env.PONDER_RPC_URL_1_FALLBACK,
      "https://eth.llamarpc.com", // Free fallback
    ],
  },
}
```

### WebSocket Configuration

For real-time updates, configure WebSocket endpoints:

```typescript
import { createConfig } from "@ponder/core";
import { webSocket } from "viem";

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      transport: webSocket(
        "wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
        {
          reconnect: true,
          reconnectDelay: 1_000,
        }
      ),
    },
  },
});
```

### Custom Transport with Rate Limiting

```typescript
import { createConfig } from "@ponder/core";
import { http } from "viem";

export default createConfig({
  chains: {
    mainnet: {
      id: 1,
      transport: http(process.env.PONDER_RPC_URL_1, {
        batch: {
          multicall: true,
          batchSize: 1000,
          wait: 50, // milliseconds
        },
        retryCount: 3,
        retryDelay: 1000,
        timeout: 30000,
      }),
    },
  },
});
```

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/bmn_indexer
DATABASE_SCHEMA=public

# RPC Endpoints
PONDER_RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PONDER_RPC_URL_10=https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PONDER_RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PONDER_RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PONDER_RPC_URL_137=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Optional: Telemetry
PONDER_TELEMETRY_DISABLED=false

# Optional: Log Level
PONDER_LOG_LEVEL=info

# Production Settings
NODE_ENV=production
PORT=42069
```

## Running the Indexer

### Development Mode

```bash
# Start the indexer with hot reloading
pnpm dev

# The indexer will:
# 1. Start syncing historical events from configured start blocks
# 2. Set up a GraphQL API at http://localhost:42069/graphql
# 3. Watch for new blocks and index events in real-time
```

### Production Mode

```bash
# Build the project
pnpm build

# Start the indexer
pnpm start

# Or run indexing and server separately
pnpm ponder index # Run indexing engine
pnpm ponder serve # Run HTTP server in separate process
```

## Production Deployment

### Database Setup

1. **Using Docker Compose (Recommended):**
   ```bash
   # Start all services
   docker-compose up -d
   
   # View logs
   docker-compose logs -f
   
   # Stop services
   docker-compose down
   
   # Stop and remove volumes (caution: deletes data)
   docker-compose down -v
   ```

2. **Manual PostgreSQL setup:**
   ```sql
   CREATE DATABASE bmn_indexer;
   ```

3. **Use deployment-specific schemas:**
   ```bash
   DATABASE_SCHEMA=prod_v1 pnpm start
   ```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Expose ports
EXPOSE 42069

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:42069/health').then(r => process.exit(r.ok ? 0 : 1))"

# Start the application
CMD ["pnpm", "start"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bmn-indexer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: bmn-indexer
  template:
    metadata:
      labels:
        app: bmn-indexer
    spec:
      containers:
      - name: indexer
        image: bmn-indexer:latest
        ports:
        - containerPort: 42069
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: bmn-secrets
              key: database-url
        - name: DATABASE_SCHEMA
          value: "indexer_$(POD_NAME)"
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        livenessProbe:
          httpGet:
            path: /health
            port: 42069
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 42069
          initialDelaySeconds: 10
          periodSeconds: 5
```

## Monitoring and Maintenance

### Health Checks

- **`/health`**: Basic health check endpoint
- **`/ready`**: Returns indexing progress and readiness status

```bash
# Check health
curl http://localhost:42069/health

# Check readiness and sync progress
curl http://localhost:42069/ready
```

### Database Maintenance

```bash
# View database status
pnpm ponder db status

# Create a new migration
pnpm ponder db create-migration

# Apply migrations
pnpm ponder db migrate

# Drop all tables (caution!)
pnpm ponder db drop
```

### Monitoring Queries

```graphql
# Check indexing progress
query IndexingStatus {
  _meta {
    status
    block {
      number
      timestamp
    }
  }
}

# Monitor bridge activity
query BridgeMetrics {
  bridgeTransactions(
    where: { timestamp_gte: "1704067200" }
    orderBy: "timestamp"
    orderDirection: "desc"
    first: 100
  ) {
    id
    user
    amount
    status
    sourceChain
    destinationChain
    timestamp
  }
}
```

## Best Practices

### 1. RPC Provider Selection
- Use paid RPC providers to avoid rate limiting
- Configure multiple RPC endpoints for redundancy
- Consider WebSocket connections for real-time updates
- Monitor RPC usage and costs
- **Based on research**: Ponder performs ~10x faster than Graph Node for initial indexing
- Consider using eRPC for cost-effective load balancing across multiple providers

### 2. Performance Optimization
- Set accurate `startBlock` values to minimize historical syncing
- Use database indexes for frequently queried fields
- Batch database operations when possible
- Keep roundtrip database latency < 50ms

### 3. Schema Design
- Design schemas for efficient querying
- Use appropriate data types (bigint for amounts, hex for addresses)
- Create indexes for common query patterns
- Consider denormalization for read-heavy workloads

### 4. Error Handling
- Implement retry logic for transient failures
- Log errors comprehensively
- Set up alerts for critical failures
- Use database transactions for data consistency

### 5. Deployment Strategy
- Use separate database schemas for different environments
- Implement blue-green deployments for zero-downtime updates
- Monitor resource usage and scale accordingly
- Regular database backups and disaster recovery plans

### 6. Security Considerations
- Secure RPC endpoints and API keys
- Use read-only database users where possible
- Implement rate limiting on public APIs
- Regular security audits of dependencies

## Troubleshooting

### Common Issues

1. **Slow Initial Sync**
   - Increase RPC rate limits
   - Use archive nodes for historical data
   - Optimize `startBlock` values

2. **Database Connection Issues**
   - Check network connectivity
   - Verify database credentials
   - Ensure proper SSL configuration

3. **Memory Issues**
   - Increase Node.js heap size: `NODE_OPTIONS="--max-old-space-size=4096"`
   - Optimize event batch sizes
   - Use database streaming for large queries

4. **WebSocket Disconnections**
   - Implement reconnection logic
   - Use fallback HTTP transport
   - Monitor connection stability

## Additional Resources

- [Ponder Documentation](https://ponder.sh/docs)
- [Ponder GitHub Repository](https://github.com/ponder-sh/ponder)
- [Ponder Examples](https://github.com/ponder-sh/ponder/tree/main/examples)
- [Viem Documentation](https://viem.sh) (for transport configuration)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [eRPC Documentation](https://erpc.cloud) (for RPC load balancing)
- [Building Cost-Effective Blockchain Infrastructure with Ponder](https://medium.com/frak-defi/building-cost-effective-blockchain-infrastructure-a-journey-with-erpc-and-ponder-e3866b0c76d7)

## Key Insights from Research

1. **Performance**: Ponder indexes ~10x faster than Graph Node from cold start and 15x faster when fully cached
2. **Multi-chain Support**: Native support for multiple chains - just add RPC URLs
3. **Developer Experience**: Familiar web development patterns with TypeScript
4. **Cost Optimization**: Can leverage free RPC tiers effectively with proper configuration
5. **Production Ready**: Used by projects like Frak for automated on-chain reward distribution

## Support

For issues specific to the BMN indexer:
- Check the logs: `pnpm ponder logs`
- Review database queries: `pnpm ponder db query`
- Join the Ponder Discord community for help

Remember to keep your indexer updated with the latest Ponder version for bug fixes and performance improvements.