# BMN Indexer v2.1.0 Factory Integration

## Overview
This document details the integration of the Bridge-Me-Not v2.1.0 CrossChainEscrowFactory contract into the indexer, completed on August 6, 2025.

## Key Changes

### 1. Contract Address Updates
- **Old Factory (v1.1.0)**: `0xB916C3edbFe574fFCBa688A6B92F72106479bD6c` (DEPRECATED)
- **New Factory (v2.1.0)**: `0xBc9A20A9FCb7571B2593e85D2533E10e3e9dC61A` (ACTIVE)
- **Deployment Date**: August 6, 2025
- **Networks**: Base (8453) and Optimism (10)

### 2. New Features in v2.1.0
- **Resolver Whitelist System**: Only whitelisted resolvers can participate
- **Emergency Pause Mechanism**: Factory owner can pause operations
- **Admin Management**: Multiple admins can manage the factory
- **Enhanced Metrics**: Detailed swap and protocol metrics
- **Interaction Tracking**: Monitor limit order protocol interactions

### 3. Updated ABIs
The following ABIs were copied from the contracts repository:
- `CrossChainEscrowFactory.v2.json` - New factory with enhanced events
- `EscrowSrc.json` - Source escrow implementation
- `EscrowDst.json` - Destination escrow implementation

### 4. Schema Additions
New tables added to track v2.1.0 events:

#### Resolver Management
- `resolver_whitelist` - Track whitelisted resolvers and their status
- `resolver_suspension` - Log resolver suspensions

#### Admin Management
- `factory_admin` - Track factory admins

#### Emergency Controls
- `emergency_pause` - Track pause/unpause events

#### Metrics and Analytics
- `swap_metrics` - Detailed swap tracking
- `interaction_tracking` - Limit order protocol interactions
- `factory_metrics` - Global protocol metrics

### 5. Event Handlers
Updated event handlers in `src/index.ts` to use `CrossChainEscrowFactoryV2`:
- `SrcEscrowCreated` - Enhanced with escrow address in event
- `DstEscrowCreated` - Track destination escrows

New event handlers in `src/v2-handlers.ts`:
- `ResolverWhitelisted` / `ResolverRemoved` - Manage resolver access
- `ResolverSuspended` / `ResolverReactivated` - Handle suspensions
- `AdminAdded` / `AdminRemoved` - Track admin changes
- `EmergencyPause` - Handle factory pausing
- `SwapInitiated` / `SwapCompleted` - High-level swap tracking
- `InteractionExecuted` / `InteractionFailed` - Interaction monitoring
- `MetricsUpdated` - Protocol-wide statistics

### 6. Configuration Updates
`ponder.config.ts`:
- Added `CrossChainEscrowFactoryV2` contract configuration
- Updated to use new factory address
- Set appropriate start blocks for v2.1.0 deployment

### 7. Database Migration
The schema changes required dropping and recreating the database schema:
```bash
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

## Migration Path

### For Resolvers
1. Contact factory owner for whitelist access
2. Update resolver to use new factory address
3. Monitor for suspension events
4. Track metrics for performance

### For Indexer Operators
1. Update to latest codebase with v2.1.0 support
2. Reset database if upgrading from v1.x
3. Monitor new event types
4. Configure alerts for emergency pause events

## Testing
The indexer has been tested and is successfully:
- Connecting to both Base and Optimism networks
- Creating all required database tables
- Syncing historical data
- Processing v2.1.0 events

## Security Considerations
- Initial whitelisted resolver: `0xfdF1dDeB176BEA06c7430166e67E615bC312b7B5`
- Factory owner: `0x5f29827e25dc174a6A51C99e6811Bbd7581285b0`
- Emergency pause capability for critical issues

## Next Steps
1. Monitor initial sync completion
2. Set up alerts for resolver events
3. Track protocol metrics
4. Document API endpoints for v2 data

## References
- [Contract Deployment Summary](../../../bmn-evm-contracts/deployments/current/v2.1.0-summary.md)
- [Indexer Guide](../../../bmn-evm-contracts/docs/INDEXER-GUIDE.md)
- [Resolver Migration Guide](../../../bmn-evm-contracts/RESOLVER_MIGRATION_GUIDE.md)