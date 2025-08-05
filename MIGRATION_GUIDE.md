# Migration Guide: Fixing Etherlink Block Range Issues

## Quick Start

1. **Backup current state**:
   ```bash
   cp ponder.config.ts ponder.config.backup.ts
   git add ponder.config.backup.ts && git commit -m "backup: save current ponder config before block range fix"
   ```

2. **Clean existing data**:
   ```bash
   make clean
   # or
   pnpm run clean
   ```

3. **Test the configuration** (optional but recommended):
   ```bash
   pnpm run test:config
   # or
   tsx scripts/test-config.ts
   ```

4. **Start with the fixed configuration**:
   ```bash
   make dev
   # or
   pnpm run dev
   ```

## What Changed

### Before (Factory Pattern for All Chains)
```typescript
BaseEscrow: {
  factory: {
    chain: {
      etherlink: {
        factory: "CrossChainEscrowFactory",
        // This bypassed maxHistoricalBlockRange!
      }
    }
  }
}
```

### After (Direct Tracking for Etherlink)
```typescript
// Track factory events directly
CrossChainEscrowFactory: {
  chain: {
    etherlink: {
      // This respects maxHistoricalBlockRange
    }
  }
}

// No factory pattern for Etherlink
BaseEscrowEtherlink: {
  chain: "etherlink",
  // No factory configuration
}
```

## Verification Steps

1. **Check logs for block range errors**:
   ```bash
   # Start indexer with trace logging
   PONDER_LOG_LEVEL=trace pnpm run dev 2>&1 | grep -E "fromBlock.*toBlock"
   
   # Look for requests exceeding 95 blocks
   # You should NOT see errors like:
   # "Error: Cannot request logs over more than 100 blocks"
   ```

2. **Monitor indexing progress**:
   ```bash
   # In another terminal
   curl http://localhost:42069/health
   ```

3. **Verify factory events are indexed**:
   ```sql
   -- Connect to database
   make psql
   
   -- Check factory events
   SELECT COUNT(*) FROM "SrcEscrow" WHERE "chainId" = 42793;
   SELECT COUNT(*) FROM "DstEscrow" WHERE "chainId" = 42793;
   ```

## Troubleshooting

### Issue: Still seeing block range errors

**Solution**: Ensure you've cleaned the cache and are using the updated config:
```bash
rm -rf .ponder
make clean
make dev
```

### Issue: Missing escrow events

**Solution**: The new configuration requires updating event handlers to filter escrow events. Check that factory events are being indexed first.

### Issue: Slow initial sync

**Solution**: Consider using more recent start blocks:
```bash
# .env or .env.local
ETHERLINK_START_BLOCK=22700000  # More recent block
```

## Rollback (if needed)

If you need to rollback to the previous configuration:
```bash
cp ponder.config.backup.ts ponder.config.ts
make clean
make dev
```

## Next Steps

1. Monitor the indexer for 24 hours to ensure stability
2. Update CREATE2 address calculation in index.ts
3. Consider contributing the fix back to Ponder project

## Support

If you encounter issues:
1. Check logs: `tail -f ponder-dev.log`
2. Review documentation: `docs/FACTORY_BLOCK_RANGE_FIX.md`
3. Test configuration: `pnpm run test:config`