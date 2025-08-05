# BMN Indexer Migration Guide: Enhanced Factory Events

This guide describes the migration process for updating the BMN EVM Contracts Indexer to support the enhanced factory events that emit escrow addresses directly.

## Overview

The Bridge Me Not protocol is being updated to emit escrow addresses directly in factory events, eliminating the need for CREATE2 address calculation and enabling the use of Ponder's factory pattern on all chains, including those with strict block range limits like Etherlink.

## Contract Changes Required

### Old Event Signatures
```solidity
event SrcEscrowCreated(
    IBaseEscrow.Immutables srcImmutables,
    IEscrowFactory.DstImmutablesComplement dstImmutablesComplement
);

event DstEscrowCreated(
    address escrow,
    bytes32 hashlock,
    Address taker
);
```

### New Event Signatures
```solidity
event SrcEscrowCreated(
    address indexed escrow,  // NEW: Escrow address as first indexed parameter
    IBaseEscrow.Immutables srcImmutables,
    IEscrowFactory.DstImmutablesComplement dstImmutablesComplement
);

event DstEscrowCreated(
    address indexed escrow,  // UPDATED: Now indexed for better query performance
    bytes32 hashlock,
    Address taker
);
```

## Migration Steps

### 1. Pre-Deployment Preparation (Current State)

The indexer code has been prepared with:
- **Enhanced configuration**: `ponder.config.enhanced.ts`
- **Enhanced event handlers**: `src/index.enhanced.ts`
- **Feature flag**: `USE_ENHANCED_EVENTS` environment variable
- **Event definitions**: `abis/enhanced-events.json`

All enhanced code is backward compatible and controlled by the feature flag.

### 2. Contract Deployment Checklist

Before deploying the updated contracts:

1. **Verify Event Signatures**
   - Ensure `SrcEscrowCreated` emits `address indexed escrow` as first parameter
   - Ensure `DstEscrowCreated` has `address indexed escrow` (indexed for efficiency)

2. **Test on Testnet**
   - Deploy contracts to testnet first
   - Test indexer with `USE_ENHANCED_EVENTS=true`
   - Verify escrow addresses are correctly captured

3. **ABI Generation**
   - Generate new ABIs from deployed contracts
   - Replace the mock enhanced event definitions with actual ABIs

### 3. Indexer Deployment Process

#### Step 1: Prepare Environment
```bash
# Copy enhanced config to main config (backup existing first)
cp ponder.config.ts ponder.config.legacy.ts
cp ponder.config.enhanced.ts ponder.config.ts

# Copy enhanced handlers to main handlers
cp src/index.ts src/index.legacy.ts
cp src/index.enhanced.ts src/index.ts
```

#### Step 2: Update Environment Variables
```bash
# Add to .env file
USE_ENHANCED_EVENTS=true

# Update start blocks if contracts are redeployed
BASE_START_BLOCK=<new_deployment_block>
ETHERLINK_START_BLOCK=<new_deployment_block>
```

#### Step 3: Update ABIs
```bash
# Replace with actual deployed contract ABIs
cp /path/to/new/CrossChainEscrowFactory.json abis/CrossChainEscrowFactory.json
```

#### Step 4: Reset and Restart Indexer
```bash
# Clean existing data
make reset

# Regenerate types
make codegen

# Start indexer with new configuration
make dev
```

### 4. Benefits of Enhanced Events

1. **Simplified Architecture**
   - No CREATE2 calculation needed
   - Direct escrow address tracking
   - Cleaner event handling code

2. **Performance Improvements**
   - Factory pattern works on all chains
   - Better indexing with indexed escrow addresses
   - Reduced computation overhead

3. **Reliability**
   - No dependency on CREATE2 implementation details
   - Works within Etherlink's 100-block query limit
   - More maintainable codebase

### 5. Rollback Plan

If issues arise after deployment:

1. **Quick Rollback**
   ```bash
   # Disable enhanced events
   USE_ENHANCED_EVENTS=false
   
   # Restart indexer
   make restart
   ```

2. **Full Rollback**
   ```bash
   # Restore legacy configuration
   cp ponder.config.legacy.ts ponder.config.ts
   cp src/index.legacy.ts src/index.ts
   
   # Reset and restart
   make reset
   make dev
   ```

## Testing Checklist

Before mainnet deployment:

- [ ] Contracts emit enhanced events correctly
- [ ] Indexer captures escrow addresses from events
- [ ] Factory pattern works on Base network
- [ ] Factory pattern works on Etherlink network
- [ ] Cross-chain correlation via hashlock works
- [ ] All escrow lifecycle events are tracked
- [ ] Statistics are updated correctly
- [ ] GraphQL queries return expected data

## Post-Migration Verification

After successful migration:

1. **Data Integrity**
   - Verify all historical escrows are indexed
   - Check cross-chain swap correlations
   - Validate statistics accuracy

2. **Performance Metrics**
   - Monitor indexing speed
   - Check RPC request volumes
   - Verify block range query efficiency

3. **Error Monitoring**
   - Watch for any CREATE2-related errors (should be none)
   - Monitor for missing escrow events
   - Check for any chain-specific issues

## Support and Troubleshooting

Common issues and solutions:

1. **Missing Escrow Events**
   - Verify `USE_ENHANCED_EVENTS=true`
   - Check contract deployment blocks
   - Ensure ABIs match deployed contracts

2. **Factory Pattern Errors**
   - Confirm event signatures match expected format
   - Verify `parameter: "escrow"` in config
   - Check indexed parameters in events

3. **Performance Issues**
   - Review block range settings
   - Check RPC endpoint health
   - Monitor database query performance

## Timeline Estimate

- Contract deployment: 1-2 days
- Testnet verification: 2-3 days
- Mainnet deployment: 1 day
- Monitoring period: 1 week

Total migration time: ~2 weeks

## Conclusion

This migration significantly improves the indexer's reliability and performance by leveraging enhanced factory events. The preparation work is complete, and the indexer is ready for deployment once the updated contracts are available.