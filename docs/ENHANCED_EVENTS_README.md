# Enhanced Factory Events Support

This document describes the enhanced factory events feature for the BMN EVM Contracts Indexer.

## Overview

The enhanced factory events feature prepares the indexer to support updated smart contracts that emit escrow addresses directly in factory events. This eliminates the need for CREATE2 address calculation and enables better performance on chains with strict block range limits.

## Current Status

- **Feature Flag**: `USE_ENHANCED_EVENTS=false` (default)
- **Code Status**: Ready for deployment
- **Backward Compatibility**: Full support for legacy events

## Files Created/Modified

### New Files
- `ponder.config.enhanced.ts` - Enhanced configuration with factory pattern for all chains
- `src/index.enhanced.ts` - Dedicated enhanced event handlers
- `abis/enhanced-events.json` - Mock event definitions for testing
- `docs/INDEXER_MIGRATION_GUIDE.md` - Complete migration guide
- `docs/ENHANCED_EVENTS_README.md` - This file

### Modified Files
- `ponder.config.ts` - Added feature flag support
- `src/index.ts` - Added conditional logic for enhanced events
- `.env.example` - Added `USE_ENHANCED_EVENTS` variable

## How It Works

### Legacy Events (Current)
```typescript
// Factory emits event WITHOUT escrow address
event SrcEscrowCreated(
    IBaseEscrow.Immutables srcImmutables,
    IEscrowFactory.DstImmutablesComplement dstImmutablesComplement
);

// Indexer calculates escrow address using CREATE2
const escrowAddress = calculateCreate2Address(...);
```

### Enhanced Events (Future)
```typescript
// Factory emits event WITH escrow address
event SrcEscrowCreated(
    address indexed escrow,  // Direct address!
    IBaseEscrow.Immutables srcImmutables,
    IEscrowFactory.DstImmutablesComplement dstImmutablesComplement
);

// Indexer uses address directly
const { escrow: escrowAddress } = event.args;
```

## Benefits

1. **Simplified Code**: No CREATE2 calculation needed
2. **Better Performance**: Factory pattern works on all chains
3. **Etherlink Support**: Works within 100-block query limits
4. **Indexed Addresses**: Faster event queries

## Activation Steps

Once contracts are deployed with enhanced events:

1. Set environment variable:
   ```bash
   USE_ENHANCED_EVENTS=true
   ```

2. Update contract ABIs with actual deployed versions

3. Reset and restart indexer:
   ```bash
   make reset
   make dev
   ```

## Testing

The code can be tested before contract deployment:

1. Deploy test contracts with enhanced events
2. Set `USE_ENHANCED_EVENTS=true`
3. Verify escrow addresses are captured correctly
4. Test cross-chain correlation works

## Rollback

If issues occur, simply set:
```bash
USE_ENHANCED_EVENTS=false
```

The indexer will revert to legacy CREATE2 calculation mode.

## Next Steps

1. Wait for contract deployment with enhanced events
2. Test on testnet first
3. Update ABIs from deployed contracts
4. Enable feature flag in production
5. Monitor for any issues

## Questions?

See `docs/INDEXER_MIGRATION_GUIDE.md` for detailed migration steps.