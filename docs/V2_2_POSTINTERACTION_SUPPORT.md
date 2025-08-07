# V2.2.0 PostInteraction Support

## Overview
This document outlines the implementation of v2.2.0 factory PostInteraction events and resolver whitelisting support in the BMN EVM Contracts Indexer.

## Implemented Features

### 1. PostInteraction Event Handlers

#### PostInteractionEscrowCreated Handler
- **Location**: `src/index.ts:872-943`
- **Purpose**: Tracks escrows created via PostInteraction after 1inch order fills
- **Key Features**:
  - Links 1inch orders to created escrows
  - Updates AtomicSwap records with PostInteraction flag
  - Creates PostInteractionOrder and PostInteractionEscrow records
  - Updates chain statistics for PostInteraction swaps

### 2. Whitelisting Event Handlers

#### ResolverWhitelisted & ResolverRemoved
- **Location**: `src/index.ts:946-1017`
- **Purpose**: Tracks resolver whitelist status for PostInteraction
- **Tables Updated**: `postInteractionResolverWhitelist`
- **Key Features**:
  - Maintains resolver whitelist state per chain
  - Tracks addition and removal timestamps
  - Handles edge cases for removed resolvers

#### MakerWhitelisted & MakerRemoved
- **Location**: `src/index.ts:1020-1088`
- **Purpose**: Tracks maker whitelist status
- **Tables Updated**: `makerWhitelist`
- **Key Features**:
  - Maintains maker whitelist state per chain
  - Tracks addition and removal timestamps
  - Used to identify PostInteraction orders in OrderFilled events

### 3. Enhanced 1inch SimpleLimitOrderProtocol Handler

#### OrderFilled Handler (Enhanced)
- **Location**: `src/index.ts:1095-1200`
- **Purpose**: Detects and tracks PostInteraction orders
- **Key Features**:
  - Checks if maker is whitelisted to identify PostInteraction orders
  - Creates pending PostInteractionOrder records
  - Links orders to escrows when PostInteractionEscrowCreated fires
  - Maintains backward compatibility with regular limit orders

### 4. V2.2.0 Factory Compatibility Handlers

#### SrcEscrowCreated & DstEscrowCreated
- **Location**: `src/index.ts:1207-1396`
- **Purpose**: Handle regular escrow creation events from v2.2.0 factory
- **Key Features**:
  - Compatible with v2.2.0 factory contract
  - Sets `postInteraction: false` for regular escrows
  - Maintains existing functionality for non-PostInteraction swaps

## Database Schema Updates

### New Tables Added:
1. **postInteractionOrder**: Tracks 1inch orders that trigger PostInteraction
2. **postInteractionResolverWhitelist**: Maintains resolver whitelist status
3. **makerWhitelist**: Maintains maker whitelist status
4. **postInteractionEscrow**: Links PostInteraction orders to escrows

### Modified Tables:
- **atomicSwap**: Added `postInteraction` boolean field to distinguish swap types

## Helper Functions

### decodeOrderHash()
- Converts bytes32 to hex string for order hash processing

### linkOrderToEscrows()
- Links 1inch orders to created escrows
- Updates PostInteractionOrder status
- Creates PostInteractionEscrow tracking records

### updateSwapStatisticsForPostInteraction()
- Updates chain statistics specifically for PostInteraction swaps
- Tracks volume locked through PostInteraction

## Configuration

### Contract Addresses
- **Factory V2.2.0**: `0xB436dBBee1615dd80ff036Af81D8478c1FF1Eb68`
- **1inch SimpleLimitOrderProtocol**: `0x111111125421ca6dc452d28d826b88f5ccd8c793`

### Start Blocks
- **Base**: 33809842
- **Optimism**: 139404873

## Event Flow

### PostInteraction Order Flow:
1. User creates 1inch limit order
2. OrderFilled event fires when order is filled
3. If maker is whitelisted, PostInteractionOrder is created (pending status)
4. PostInteractionEscrowCreated event fires
5. Order is linked to escrows and status updated to "filled"
6. AtomicSwap record is marked with `postInteraction: true`

### Whitelisting Flow:
1. Admin adds resolver/maker via factory contract
2. ResolverWhitelisted/MakerWhitelisted event fires
3. Whitelist record created/updated in database
4. Used to identify PostInteraction orders and validate resolvers

## Testing Recommendations

1. **Event Handler Testing**:
   - Test PostInteractionEscrowCreated with various order types
   - Verify whitelisting events update database correctly
   - Ensure OrderFilled correctly identifies PostInteraction orders

2. **Integration Testing**:
   - Test full flow from 1inch order to escrow creation
   - Verify statistics are updated correctly
   - Test edge cases (removed resolvers, duplicate events)

3. **Performance Testing**:
   - Monitor indexing speed with PostInteraction events
   - Check database query performance with new tables
   - Validate memory usage with enhanced handlers

## Monitoring

Key metrics to track:
- Number of PostInteraction orders vs regular orders
- Whitelisted resolvers/makers count
- PostInteraction success rate
- Average time from OrderFilled to PostInteractionEscrowCreated

## Future Enhancements

1. Add more detailed PostInteraction analytics
2. Track resolver performance metrics
3. Implement PostInteraction-specific volume tracking
4. Add alerts for unusual PostInteraction patterns
5. Create dedicated API endpoints for PostInteraction queries

## Migration Notes

When deploying these changes:
1. Run `pnpm run codegen` to generate TypeScript types
2. Ensure database migrations include new tables
3. Verify factory v2.2.0 ABI is correct
4. Test with a few blocks before full sync
5. Monitor logs for any unexpected errors

## Related Files

- **Schema**: `ponder.schema.ts`
- **Config**: `ponder.config.ts`
- **Handlers**: `src/index.ts`
- **Factory ABI**: `abis/CrossChainEscrowFactoryV2_2.json`
- **Check Script**: `scripts/check-events.sh`