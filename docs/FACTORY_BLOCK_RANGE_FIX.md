# Factory Pattern Block Range Fix for Ponder v0.12

## Problem Summary

The BMN EVM Contracts Indexer was experiencing failures on Etherlink due to the network's strict 100-block limit for `eth_getLogs` requests. Despite setting `maxHistoricalBlockRange: 50` in the chain configuration, factory contract queries were still exceeding this limit (e.g., querying 128-168 blocks at once).

### Root Cause

Ponder v0.12's factory pattern appears to bypass the chain's `maxHistoricalBlockRange` setting during the initial factory event collection phase. This happens because:

1. Factory pattern performs a separate initial scan to collect child contract addresses
2. This scan may not respect the configured block range limits
3. The issue is particularly problematic on networks with strict RPC limits like Etherlink

## Solution Overview

We've developed multiple approaches to address this issue:

### 1. **Avoid Factory Pattern for Limited Networks** (Recommended)

For networks with strict block limits like Etherlink, avoid using the factory pattern entirely:

```typescript
// Instead of using factory pattern:
BaseEscrow: {
  abi: BaseEscrowAbi.abi,
  factory: { /* ... */ }, // AVOID THIS
}

// Use direct contract tracking:
CrossChainEscrowFactory: {
  abi: CrossChainEscrowFactoryAbi.abi,
  address: FACTORY_ADDRESS,
  chain: {
    etherlink: {
      address: FACTORY_ADDRESS,
      startBlock: 22523319,
      // This WILL respect maxHistoricalBlockRange
    }
  }
}
```

### 2. **Separate Factory Contracts per Chain**

Define separate factory contracts for each chain to avoid shared configuration issues:

```typescript
contracts: {
  CrossChainEscrowFactoryBase: {
    abi: factoryAbi,
    address: FACTORY_ADDRESS,
    chain: "base",
    startBlock: 33726385,
  },
  
  CrossChainEscrowFactoryEtherlink: {
    abi: factoryAbi,
    address: FACTORY_ADDRESS,
    chain: "etherlink",
    startBlock: 22523319,
  },
}
```

### 3. **Manual Escrow Tracking**

Track escrow addresses from factory events and handle escrow events manually:

```typescript
// In event handlers:
ponder.on("CrossChainEscrowFactory:SrcEscrowCreated", async ({ event, context }) => {
  // Calculate escrow address
  const escrowAddress = calculateCreate2Address(...);
  
  // Store in database for tracking
  await trackEscrowContract(context, chainId, escrowAddress);
  
  // Process normally...
});
```

## Implementation Steps

### Step 1: Update ponder.config.ts

Replace the current configuration with the fixed version:

```bash
# Backup current config
cp ponder.config.ts ponder.config.backup.ts

# Use the fixed configuration
cp ponder.config.final.ts ponder.config.ts
```

### Step 2: Update Event Handlers

For Etherlink escrow events, implement address filtering:

```typescript
// Check if event is from a tracked escrow
const isTrackedEscrow = await context.db.find(srcEscrow, {
  id: `${chainId}-${event.log.address}`
});

if (!isTrackedEscrow) {
  return; // Ignore events from unknown escrows
}
```

### Step 3: Configure Environment

Ensure block limits are properly set:

```bash
# .env or .env.local
ETHERLINK_START_BLOCK=22523319
BASE_START_BLOCK=33726385

# Optional: Use more recent blocks if full history isn't needed
ETHERLINK_FACTORY_START=22700000  # More recent starting point
```

### Step 4: Test the Configuration

```bash
# Clean previous state
pnpm run clean

# Test with trace logging
PONDER_LOG_LEVEL=trace pnpm run dev

# Monitor for block range errors
# You should NOT see errors like:
# "Error: Cannot request logs over more than 100 blocks"
```

## Configuration Options

### Option A: No Factory Pattern (Most Reliable)

```typescript
contracts: {
  // Track factory events directly
  CrossChainEscrowFactory: {
    abi: factoryAbi,
    address: FACTORY_ADDRESS,
    chain: {
      etherlink: {
        startBlock: 22523319,
        // Respects maxHistoricalBlockRange
      }
    }
  },
  
  // Track escrow events without factory
  BaseEscrow: {
    abi: escrowAbi,
    chain: "etherlink",
    startBlock: 22523319,
    // No factory configuration
  }
}
```

### Option B: Hybrid Approach

Use factory pattern for chains with high limits, direct tracking for limited chains:

```typescript
contracts: {
  // Base: Use factory pattern (high limits)
  BaseEscrowBase: {
    abi: escrowAbi,
    chain: "base",
    factory: { /* factory config */ }
  },
  
  // Etherlink: Direct tracking (low limits)
  CrossChainEscrowFactoryEtherlink: {
    abi: factoryAbi,
    address: FACTORY_ADDRESS,
    chain: "etherlink",
  }
}
```

### Option C: Pre-defined Addresses

If you know specific escrow addresses:

```typescript
KnownEscrows: {
  abi: escrowAbi,
  address: [
    "0x123...", // Known escrow 1
    "0x456...", // Known escrow 2
  ],
  chain: "etherlink",
  startBlock: 22523319,
}
```

## Monitoring and Validation

### 1. Check Block Range Queries

Monitor logs for block range requests:

```bash
# Look for eth_getLogs requests
PONDER_LOG_LEVEL=trace pnpm run dev 2>&1 | grep -E "fromBlock.*toBlock"

# Ensure no requests exceed 95 blocks for Etherlink
```

### 2. Verify Factory Event Collection

```sql
-- Check factory events are being indexed
SELECT COUNT(*) FROM "SrcEscrow" WHERE "chainId" = 42793;
SELECT COUNT(*) FROM "DstEscrow" WHERE "chainId" = 42793;
```

### 3. Monitor Performance

```bash
# Check indexing progress
curl http://localhost:42069/ready

# View sync status
curl http://localhost:42069/health
```

## Troubleshooting

### Issue: Still seeing block range errors

1. Ensure you're using the updated configuration
2. Clear Ponder cache: `rm -rf .ponder`
3. Check that `maxHistoricalBlockRange` is set correctly
4. Verify no factory pattern is used for Etherlink

### Issue: Missing escrow events

1. Ensure factory events are being tracked
2. Check that escrow addresses are being calculated correctly
3. Verify CREATE2 address calculation implementation

### Issue: Slow indexing

1. Consider using more recent start blocks
2. Increase `syncBatchSize` within safe limits
3. Use WebSocket connections when available

## Trade-offs

### Factory Pattern Approach
- ✅ Automatic escrow discovery
- ✅ Simple configuration
- ❌ May bypass block limits
- ❌ Not suitable for limited RPCs

### Direct Tracking Approach
- ✅ Respects all block limits
- ✅ Full control over queries
- ❌ More complex implementation
- ❌ Requires manual escrow tracking

## Next Steps

1. **Immediate**: Apply the fixed configuration to resolve block range errors
2. **Short-term**: Implement proper CREATE2 address calculation
3. **Long-term**: Consider contributing block range fixes to Ponder project

## References

- [Ponder Factory Pattern Guide](https://ponder.sh/docs/guides/factory)
- [Ponder Configuration Docs](https://ponder.sh/docs/config/contracts)
- [Etherlink RPC Documentation](https://docs.etherlink.com/building-on-etherlink/using-your-wallet/network-information)

---

*Last updated: January 2025*