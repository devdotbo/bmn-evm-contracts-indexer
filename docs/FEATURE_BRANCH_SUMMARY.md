# Feature Branch: enhanced-factory-events

## Summary

This feature branch prepares the BMN EVM Contracts Indexer to support enhanced factory events that emit escrow addresses directly. The implementation is fully backward compatible and controlled by a feature flag.

## Current Branch Status

- **Branch Name**: `feature/enhanced-factory-events`
- **Feature Flag**: `USE_ENHANCED_EVENTS=false` (default)
- **Deployment Status**: Ready but waiting for contract updates

## Changes Made

### 1. Environment Configuration
- Added `USE_ENHANCED_EVENTS` flag to `.env.example`
- Default is `false` to maintain current behavior

### 2. Enhanced Event Definitions
- Created `abis/enhanced-events.json` with new event signatures
- Created `abis/CrossChainEscrowFactory.enhanced.json` (copy for testing)
- New events include `address indexed escrow` as first parameter

### 3. Configuration Updates
- Created `ponder.config.enhanced.ts` with factory pattern for both chains
- Updated `ponder.config.ts` to support feature flag
- Factory pattern now works on Etherlink with enhanced events

### 4. Event Handler Updates
- Created `src/index.enhanced.ts` with simplified handlers
- Updated `src/index.ts` with conditional logic
- No CREATE2 calculation needed with enhanced events

### 5. Documentation
- `docs/INDEXER_MIGRATION_GUIDE.md` - Complete migration instructions
- `docs/ENHANCED_EVENTS_README.md` - Feature overview and usage

## Benefits

1. **Simplified Code**: Direct escrow address from events
2. **Better Performance**: Factory pattern on all chains
3. **Etherlink Support**: Works within 100-block limits
4. **Future Proof**: Ready for contract updates

## Next Steps

1. **Wait for Contracts**: The smart contracts need to be updated and deployed
2. **Update ABIs**: Replace mock ABIs with actual deployed contract ABIs
3. **Test on Testnet**: Verify enhanced events work correctly
4. **Enable Feature**: Set `USE_ENHANCED_EVENTS=true`
5. **Deploy to Production**: Follow migration guide

## Testing

To test the enhanced events:
```bash
# Set feature flag
export USE_ENHANCED_EVENTS=true

# Reset and start indexer
make reset
make dev
```

## Rollback

If issues occur:
```bash
# Disable enhanced events
export USE_ENHANCED_EVENTS=false

# Restart indexer
make restart
```

## Important Notes

- The code is fully functional with current contracts (USE_ENHANCED_EVENTS=false)
- No changes needed until new contracts are deployed
- All changes are isolated in the feature branch
- Migration can be done gradually with feature flag

## Commits in Branch

1. `5573714` - chore: add USE_ENHANCED_EVENTS feature flag to environment example
2. `413141c` - feat: add enhanced event definitions for future factory events with escrow addresses
3. `190ad0a` - feat: create enhanced ponder config with factory pattern for both chains
4. `8858afd` - feat: implement enhanced event handlers that use escrow addresses directly
5. `895ae40` - feat: add backward compatibility for enhanced events in main config and handlers
6. `154062a` - docs: add comprehensive migration guide and enhanced events documentation

This branch is ready to merge once the smart contracts are updated and tested.