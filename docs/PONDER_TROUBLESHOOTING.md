# Ponder Indexer Troubleshooting Guide

This guide documents common issues and solutions for the BMN EVM Contracts Indexer using Ponder v0.12.0.

## Table of Contents
- [Critical Issues and Solutions](#critical-issues-and-solutions)
- [Environment Configuration](#environment-configuration)
- [Debugging Tools](#debugging-tools)
- [Performance Optimization](#performance-optimization)

## Critical Issues and Solutions

### 1. Context API Changes (Ponder v0.12.0)

**Error:**
```
TypeError: Cannot read property 'chainId' of undefined
context.network.chainId
               ^
```

**Solution:**
In Ponder v0.12.0, the context object structure changed:
- ❌ `context.network.chainId` (old)
- ✅ `context.chain.id` (new)

Update all event handlers:
```typescript
// Before
const chainId = context.network.chainId;

// After
const chainId = context.chain.id;
```

### 2. Database Record Not Found Errors

**Error:**
```
RecordNotFoundError: No existing record found in table 'chain_statistics'
```

**Solution:**
Use upsert pattern (insert with onConflictDoUpdate) instead of direct updates:

```typescript
// Before - fails if record doesn't exist
await context.db.update(chainStatistics, { id: chainId.toString() })
  .set((row) => ({ totalWithdrawals: row.totalWithdrawals + 1n }));

// After - creates record if it doesn't exist
await context.db
  .insert(chainStatistics)
  .values({
    id: chainId.toString(),
    chainId: chainId,
    totalSrcEscrows: 0n,
    totalDstEscrows: 0n,
    totalWithdrawals: 1n,
    totalCancellations: 0n,
    totalVolumeLocked: 0n,
    totalVolumeWithdrawn: 0n,
    lastUpdatedBlock: event.block.number,
  })
  .onConflictDoUpdate((row) => ({
    totalWithdrawals: row.totalWithdrawals + 1n,
    lastUpdatedBlock: event.block.number,
  }));
```

### 3. Block Range Limit Errors

**Error:**
```
Error: Cannot request logs over more than 100 blocks
Error: Cannot request logs over more than 1000 blocks
```

**Solution:**
Configure appropriate block ranges in `ponder.config.ts`:

```typescript
chains: {
  base: {
    id: 8453,
    transport: fallback([
      webSocket(process.env.PONDER_WS_URL_8453),
      http(process.env.PONDER_RPC_URL_8453)
    ]),
    maxHistoricalBlockRange: 5000,  // Adjust based on RPC limits
    syncBatchSize: 2000,
  },
  etherlink: {
    id: 42793,
    transport: fallback([
      webSocket(process.env.PONDER_WS_URL_42793),
      http(process.env.PONDER_RPC_URL_42793)
    ]),
    maxHistoricalBlockRange: 2000,  // Lower for stricter RPCs
    syncBatchSize: 1000,
  },
}
```

### 4. Environment Variables Not Loading

**Issue:** Ponder uses default/public RPC endpoints instead of configured ones

**Solution:**
Ponder loads `.env.local` by default, NOT `.env`. Ensure your environment variables are in `.env.local`:

```bash
# Create .env.local from .env.example
cp .env.example .env.local

# Edit .env.local with your actual RPC URLs
PONDER_RPC_URL_8453=https://your-base-rpc-url
PONDER_WS_URL_8453=wss://your-base-websocket-url
PONDER_RPC_URL_42793=https://your-etherlink-rpc-url
PONDER_WS_URL_42793=wss://your-etherlink-websocket-url
```

## Environment Configuration

### Required Environment Variables (.env.local)

```bash
# Base Mainnet (Chain ID: 8453)
PONDER_RPC_URL_8453=https://your-base-rpc-url
PONDER_WS_URL_8453=wss://your-base-websocket-url

# Etherlink Mainnet (Chain ID: 42793)
PONDER_RPC_URL_42793=https://your-etherlink-rpc-url
PONDER_WS_URL_42793=wss://your-etherlink-websocket-url

# Database Configuration
DATABASE_URL=postgres://ponder:ponder123@localhost:5432/bmn_indexer

# Logging (optional)
PONDER_LOG_LEVEL=info  # Options: error, warn, info, debug, trace
```

### RPC Endpoint Requirements

Different RPC providers have different limits:

| Provider | Max Block Range | Recommended Settings |
|----------|----------------|---------------------|
| Public Etherlink | 1000 blocks | maxHistoricalBlockRange: 500 |
| Ankr | 100 blocks | maxHistoricalBlockRange: 50 |
| Alchemy/Infura | 10000+ blocks | maxHistoricalBlockRange: 5000 |
| Local Node | No limit | maxHistoricalBlockRange: 10000 |

## Debugging Tools

### 1. Debug Scripts

**run-dev.sh** - Run with debug logging:
```bash
./run-dev.sh
```

**run-trace.sh** - Run with trace logging (maximum verbosity):
```bash
./run-trace.sh
```

### 2. Finding Deployment Blocks

Use the deployment block finder script:
```bash
./scripts/find-deployment-block.sh
```

This will output:
```
Checking Base (8453)...
  Latest block: 33734947
  Deployment block: 33726385
  Deployment date: Sun Aug 3 19:28:37 CEST 2025

Checking Etherlink (42793)...
  Latest block: 22535873
  Deployment block: 22523319
  Deployment date: Sun Aug 3 19:28:55 CEST 2025
```

### 3. Common Debug Commands

```bash
# Check Ponder version
pnpm list ponder

# Clear cache and restart
pnpm run clean
pnpm run dev

# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# View recent logs
tail -f ponder-dev.log
```

## Performance Optimization

### 1. Transport Configuration

Use WebSocket with HTTP fallback for best performance:

```typescript
transport: fallback([
  webSocket(process.env.PONDER_WS_URL_8453),  // Primary: WebSocket
  http(process.env.PONDER_RPC_URL_8453)       // Fallback: HTTP
])
```

### 2. Batch Settings

Optimize multicall batching:

```typescript
http(process.env.PONDER_RPC_URL_8453, {
  batch: {
    multicall: {
      batchSize: 128,  // Increase for better performance
      wait: 16,        // Decrease wait time between batches
    },
  },
  retryCount: 3,
  retryDelay: 500,
})
```

### 3. Database Optimization

For production deployments:

```bash
# Use connection pooling
DATABASE_URL=postgres://user:pass@host:5432/db?pool_max=20

# Run with dedicated schema
pnpm start --schema production_v1
```

## Troubleshooting Checklist

When encountering issues:

1. ✅ Check you're using `.env.local` (not `.env`)
2. ✅ Verify RPC URLs are accessible: `curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' YOUR_RPC_URL`
3. ✅ Ensure deployment blocks are correct in `ponder.config.ts`
4. ✅ Run with trace logging: `./run-trace.sh`
5. ✅ Check database connectivity: `psql $DATABASE_URL`
6. ✅ Clear cache if needed: `pnpm run clean`
7. ✅ Verify Ponder version: `pnpm list ponder` (should be ^0.12.0)

## Common Error Patterns

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `context.network is undefined` | Ponder v0.12.0 API change | Use `context.chain` instead |
| `Cannot request logs over X blocks` | RPC block limit exceeded | Reduce `maxHistoricalBlockRange` |
| `RecordNotFoundError` | Missing database record | Use upsert pattern |
| `ECONNREFUSED` | Database not running | Start PostgreSQL |
| `Invalid block tag` | Using "latest" as startBlock | Use actual block number |

## Additional Resources

- [Ponder Documentation](https://ponder.sh/docs)
- [Migration Guide (v0.12)](https://ponder.sh/docs/migration-guide#0-12)
- [Project Status](./PROJECT_STATUS.md)
- [Database Setup](./POSTGRES.md)