# Ponder Schema Fix Guide for BMN EVM Contracts Indexer

## Problem Summary

The current implementation has several critical issues:

1. **Incorrect Schema Definition**: Using `onchainTable` which doesn't exist in Ponder v0.4
2. **Wrong Database Operations**: Using `insert()` method that's not available in Ponder's context.db
3. **Import Issues**: Importing from non-existent modules
4. **Type Mismatches**: Schema types don't align with Ponder's expected format

## Solution Overview

The fix involves:
- Converting to Ponder v0.4's `p` schema builder syntax
- Using correct database operations (`create`, `update`, `upsert`)
- Fixing all imports to use `@ponder/core`
- Ensuring proper ID field types and naming conventions

## Step-by-Step Fix

### 1. Complete Corrected ponder.schema.ts

Replace the entire `ponder.schema.ts` file with:

```typescript
import { createSchema } from "@ponder/core";

export default createSchema((p) => ({
  CrossChainEscrowFactory: p.createTable({
    id: p.hex(),
    baseEscrowImplementation: p.hex(),
    owner: p.hex(),
    createdAt: p.bigint(),
    createdAtBlock: p.bigint(),
    updatedAt: p.bigint(),
    updatedAtBlock: p.bigint(),
  }),

  BaseEscrow: p.createTable({
    id: p.hex(),
    factory: p.hex().references("CrossChainEscrowFactory.id"),
    createdAt: p.bigint(),
    createdAtBlock: p.bigint(),
    updatedAt: p.bigint(),
    updatedAtBlock: p.bigint(),
  }),

  EscrowFund: p.createTable({
    id: p.string(), // format: "escrowId-chainId-depositor-timestamp"
    escrowId: p.hex().references("BaseEscrow.id"),
    chainId: p.bigint(),
    depositor: p.hex(),
    amount: p.bigint(),
    timestamp: p.bigint(),
    blockNumber: p.bigint(),
    transactionHash: p.hex(),
  }),

  EscrowRelease: p.createTable({
    id: p.string(), // format: "escrowId-chainId-releaseId"
    escrowId: p.hex().references("BaseEscrow.id"),
    chainId: p.bigint(),
    escrowAddress: p.hex(),
    amount: p.bigint(),
    releaseId: p.bigint(),
    timestamp: p.bigint(),
    blockNumber: p.bigint(),
    transactionHash: p.hex(),
  }),

  CrossChainDeposit: p.createTable({
    id: p.string(), // format: "fromChain-toChain-depositId-timestamp"
    depositId: p.hex(),
    fromChain: p.bigint(),
    toChain: p.bigint(),
    depositor: p.hex(),
    recipient: p.hex(),
    amount: p.bigint(),
    timestamp: p.bigint(),
    blockNumber: p.bigint(),
    transactionHash: p.hex(),
  }),

  CrossChainRelease: p.createTable({
    id: p.string(), // format: "depositId-chainId-timestamp"
    depositId: p.hex(),
    chainId: p.bigint(),
    recipient: p.hex(),
    amount: p.bigint(),
    timestamp: p.bigint(),
    blockNumber: p.bigint(),
    transactionHash: p.hex(),
  }),

  OwnershipTransfer: p.createTable({
    id: p.string(), // format: "contractId-blockNumber-logIndex"
    contractId: p.hex(),
    contractType: p.string(), // "Factory" or "Escrow"
    previousOwner: p.hex(),
    newOwner: p.hex(),
    timestamp: p.bigint(),
    blockNumber: p.bigint(),
    transactionHash: p.hex(),
  }),

  ChainMetrics: p.createTable({
    id: p.string(), // format: "chainId"
    chainId: p.bigint(),
    totalDeposits: p.bigint(),
    totalReleases: p.bigint(),
    totalVolume: p.bigint(),
    lastActivityTimestamp: p.bigint(),
    lastActivityBlock: p.bigint(),
  }),

  UserActivity: p.createTable({
    id: p.string(), // format: "chainId-userAddress"
    chainId: p.bigint(),
    userAddress: p.hex(),
    depositsCount: p.int(),
    releasesCount: p.int(),
    totalDeposited: p.bigint(),
    totalReleased: p.bigint(),
    firstActivityTimestamp: p.bigint(),
    lastActivityTimestamp: p.bigint(),
  }),
}));
```

### 2. Updated Database Operation Examples

Replace all database operations in `src/index.ts`:

#### For Factory Deployment:
```typescript
ponder.on("CrossChainEscrowFactory:Deployed", async ({ event, context }) => {
  await context.db.CrossChainEscrowFactory.create({
    id: event.log.address,
    data: {
      baseEscrowImplementation: event.args.baseEscrowImplementation,
      owner: event.args.owner,
      createdAt: event.block.timestamp,
      createdAtBlock: event.block.number,
      updatedAt: event.block.timestamp,
      updatedAtBlock: event.block.number,
    },
  });
});
```

#### For Escrow Creation:
```typescript
ponder.on("CrossChainEscrowFactory:EscrowCreated", async ({ event, context }) => {
  await context.db.BaseEscrow.create({
    id: event.args.escrow,
    data: {
      factory: event.log.address,
      createdAt: event.block.timestamp,
      createdAtBlock: event.block.number,
      updatedAt: event.block.timestamp,
      updatedAtBlock: event.block.number,
    },
  });
});
```

#### For Escrow Fund (with upsert for metrics):
```typescript
ponder.on("BaseEscrow:Funded", async ({ event, context }) => {
  const fundId = `${event.log.address}-${event.args.chainId}-${event.args.depositor}-${event.block.timestamp}`;
  
  // Create fund record
  await context.db.EscrowFund.create({
    id: fundId,
    data: {
      escrowId: event.log.address,
      chainId: event.args.chainId,
      depositor: event.args.depositor,
      amount: event.args.amount,
      timestamp: event.block.timestamp,
      blockNumber: event.block.number,
      transactionHash: event.log.transactionHash,
    },
  });

  // Update chain metrics
  await context.db.ChainMetrics.upsert({
    id: event.args.chainId.toString(),
    create: {
      chainId: event.args.chainId,
      totalDeposits: 1n,
      totalReleases: 0n,
      totalVolume: event.args.amount,
      lastActivityTimestamp: event.block.timestamp,
      lastActivityBlock: event.block.number,
    },
    update: ({ current }) => ({
      totalDeposits: current.totalDeposits + 1n,
      totalVolume: current.totalVolume + event.args.amount,
      lastActivityTimestamp: event.block.timestamp,
      lastActivityBlock: event.block.number,
    }),
  });

  // Update user activity
  const userActivityId = `${event.args.chainId}-${event.args.depositor}`;
  await context.db.UserActivity.upsert({
    id: userActivityId,
    create: {
      chainId: event.args.chainId,
      userAddress: event.args.depositor,
      depositsCount: 1,
      releasesCount: 0,
      totalDeposited: event.args.amount,
      totalReleased: 0n,
      firstActivityTimestamp: event.block.timestamp,
      lastActivityTimestamp: event.block.timestamp,
    },
    update: ({ current }) => ({
      depositsCount: current.depositsCount + 1,
      totalDeposited: current.totalDeposited + event.args.amount,
      lastActivityTimestamp: event.block.timestamp,
    }),
  });
});
```

### 3. Import Fixes

Update all imports in `src/index.ts`:

```typescript
import { ponder } from "@/generated";
// Remove any imports from 'drizzle-orm' or other ORM libraries
// Remove any imports of 'db' or schema objects
```

## Migration Checklist

### Files to Update:
- [x] `/ponder.schema.ts` - Complete replacement with new schema
- [x] `/src/index.ts` - Update all database operations
- [ ] Remove any custom database utilities or helpers
- [ ] Update `.env` file if needed (should already be correct)
- [ ] Verify `ponder.config.ts` uses correct contract addresses

### Database Operations to Replace:
- [x] `db.insert()` → `context.db.TableName.create()`
- [x] `db.select()` → `context.db.TableName.findUnique()` or `findMany()`
- [x] `db.update()` → `context.db.TableName.update()`
- [x] Add proper `upsert` operations for metrics

### Type Changes:
- [x] All ID fields must be strings or hex
- [x] Use `p.hex()` for addresses
- [x] Use `p.bigint()` for uint256 values
- [x] Use `p.int()` for counters
- [x] Use `p.string()` for composite IDs

## Testing Plan

### 1. Schema Validation
```bash
# This should complete without errors
ponder codegen
```

### 2. Type Checking
```bash
# Ensure TypeScript compilation passes
pnpm typecheck
```

### 3. Local Testing
```bash
# Start the indexer in development mode
ponder dev

# Watch for:
# - Successful schema creation
# - No runtime errors on event processing
# - Proper data insertion in the database
```

### 4. Database Verification
```bash
# Connect to the local database and verify tables exist
# Check that data is being inserted correctly
# Verify relationships between tables work
```

### 5. Event Processing Test
1. Deploy test contracts on a testnet
2. Perform test transactions:
   - Deploy factory
   - Create escrow
   - Fund escrow
   - Release funds
3. Verify all events are indexed correctly

### 6. Performance Check
- Monitor indexing speed
- Check database query performance
- Verify no memory leaks during long-running indexing

## Common Issues and Solutions

### Issue: "Cannot find module '@/generated'"
**Solution**: Run `ponder codegen` to generate types

### Issue: "Table not found" errors
**Solution**: Ensure schema is properly defined and `ponder dev` has been restarted

### Issue: Type errors in event handlers
**Solution**: Use the generated types from `@/generated` for type safety

### Issue: Duplicate key errors
**Solution**: Ensure ID generation creates unique identifiers for each record

## Next Steps

After implementing these fixes:
1. Test thoroughly on a testnet
2. Add error handling for edge cases
3. Implement data retention policies if needed
4. Set up monitoring and alerting
5. Document any custom business logic

## Additional Resources

- [Ponder v0.4 Documentation](https://ponder.sh/docs/getting-started/new-project)
- [Schema API Reference](https://ponder.sh/docs/schema)
- [Indexing Functions Guide](https://ponder.sh/docs/indexing/create-update-records)