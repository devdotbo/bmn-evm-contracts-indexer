# BaseEscrow Event Tracking Implementation

## Overview

This document describes how BaseEscrow events are tracked in the Ponder indexer for dynamically created escrow contracts.

## Challenge

The CrossChainEscrowFactory creates two types of escrow contracts:
1. **SrcEscrow**: Created via `SrcEscrowCreated` event (doesn't emit the escrow address directly)
2. **DstEscrow**: Created via `DstEscrowCreated` event (emits the escrow address)

## Solution

### 1. DstEscrow Tracking (Factory Pattern)

For DstEscrow contracts, we use Ponder's factory pattern since the `DstEscrowCreated` event directly emits the escrow address:

```typescript
DstEscrow: {
  abi: BaseEscrowAbi.abi,
  address: factory({
    address: "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1",
    event: parseAbiItem("event DstEscrowCreated(address escrow, bytes32 hashlock, uint256 taker)"),
    parameter: "escrow",
  }),
  // ...
}
```

This automatically tracks all DstEscrow contracts and their events:
- `DstEscrow:EscrowWithdrawal`
- `DstEscrow:EscrowCancelled`
- `DstEscrow:FundsRescued`

### 2. SrcEscrow Tracking (Transaction Receipt Parsing)

For SrcEscrow contracts, we cannot use the factory pattern because the address must be calculated using CREATE2. Instead:

1. Enable transaction receipts for the factory contract:
   ```typescript
   includeTransactionReceipts: true
   ```

2. Calculate the escrow address using CREATE2 when `SrcEscrowCreated` is emitted

3. Parse transaction logs to find BaseEscrow events from the newly created escrow

4. Process these events using a helper function that mimics the standard event handlers

## Event Handlers

### DstEscrow Events
- Handled automatically through Ponder's factory pattern
- Event handlers registered as `DstEscrow:EventName`

### SrcEscrow Events
- Captured during `SrcEscrowCreated` processing
- Parsed from transaction receipts
- Processed using the `processSrcEscrowEvent` helper function

## Key Components

1. **Address Calculation**: Uses CREATE2 formula to determine SrcEscrow addresses
2. **Event Decoding**: Uses viem's `decodeEventLog` to parse BaseEscrow events
3. **Unified Processing**: Both SrcEscrow and DstEscrow events update the same database tables

## Limitations

- SrcEscrow events that occur after creation (not in the same transaction) require additional handling
- Consider implementing a periodic sync mechanism or monitoring known escrow addresses

## Future Improvements

1. Implement a registry of all known escrow addresses
2. Add periodic scanning of known escrow contracts for missed events
3. Consider using Ponder's block interval feature to periodically check for events