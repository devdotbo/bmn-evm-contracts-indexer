# BMN EVM Contracts Indexer

A Ponder indexer for the Bridge Me Not (BMN) atomic swap protocol, tracking cross-chain escrow operations across Base and Etherlink networks.

## Overview

This indexer tracks:
- Source and destination escrow creation events
- Withdrawal and cancellation events
- Cross-chain atomic swap state
- Protocol statistics and analytics

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
- Copy `.env.example` to `.env` (if needed)
- Update RPC endpoints and start blocks

3. Run the indexer:
```bash
# Development mode
npm run dev

# Production mode
npm run start
```

## Architecture

### Contracts Tracked

- **CrossChainEscrowFactory** (`0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1`)
  - Deploys source and destination escrows
  - Emits `SrcEscrowCreated` and `DstEscrowCreated` events

- **BaseEscrow** (Dynamic addresses)
  - Individual escrow contracts created by the factory
  - Emits `EscrowWithdrawal`, `EscrowCancelled`, and `FundsRescued` events

### Database Schema

The indexer maintains several tables:

1. **SrcEscrow**: Tracks source chain escrows
2. **DstEscrow**: Tracks destination chain escrows
3. **EscrowWithdrawal**: Records successful withdrawals
4. **EscrowCancellation**: Records cancelled escrows
5. **FundsRescued**: Tracks rescued funds events
6. **AtomicSwap**: Aggregates cross-chain swap state
7. **ChainStatistics**: Protocol analytics per chain

### API Endpoints

The indexer provides:
- GraphQL API at `/graphql`
- SQL query interface at `/sql/*`

## Key Features

- Multi-chain support (Base & Etherlink)
- Real-time event tracking via WebSocket connections
- Automatic escrow address tracking from factory events
- Cross-chain atomic swap state management
- Protocol statistics and analytics

## Development

### Adding New Chains

1. Update `.env` with new chain RPC endpoints
2. Add chain configuration in `ponder.config.ts`
3. Update chain IDs in indexing handlers

### Modifying Schema

1. Edit `ponder.schema.ts`
2. Run `npm run codegen` to generate types
3. Update indexing handlers as needed

## Notes

- Escrow addresses are dynamically created via CREATE2
- The indexer tracks both source and destination escrows
- Cross-chain state is maintained in the AtomicSwap table
- Statistics are updated in real-time per chain