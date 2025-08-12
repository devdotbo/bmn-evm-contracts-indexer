## v2.3.0 (Indexer)

- Switch to v2.3 factory (`SimplifiedEscrowFactoryV2_3`) with hardcoded start blocks.
  - Base startBlock: 34110108
  - Optimism startBlock: 139706679
- Replace JSON ABIs with human-readable ABIs and viem `parseAbi`.
  - Added `abis/human/SimplifiedEscrowFactoryV2_3.readable.json`
  - Fixed `abis/human/BmnToken.readable.json` (Transfer/Approval)
  - Simplified `abis/human/SimpleLimitOrderProtocol.readable.json` to events-only
- Update handlers to v2.3 event sources in `src/index.ts`.
- Clean up legacy v2.2 ABI files and references.


