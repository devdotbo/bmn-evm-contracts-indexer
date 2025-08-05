import { ponder } from "ponder:registry";
import { 
  srcEscrow, 
  dstEscrow, 
  escrowWithdrawal, 
  escrowCancellation, 
  fundsRescued, 
  atomicSwap,
  chainStatistics 
} from "ponder:schema";

// Import viem for dynamic contract tracking
import { getContract } from "viem";
import BaseEscrowAbi from "../abis/BaseEscrow.json";

// Track discovered escrow contracts
const escrowContracts = new Map<string, Set<string>>();

// Helper function to decode packed address from uint256
function decodeAddress(packedAddress: bigint): string {
  const address = packedAddress & ((1n << 160n) - 1n);
  return `0x${address.toString(16).padStart(40, '0')}`;
}

// Helper function to calculate CREATE2 address
function calculateCreate2Address(
  factory: string,
  salt: string,
  initCodeHash: string
): string {
  // Placeholder - implement actual CREATE2 calculation
  return "0x" + "0".repeat(40);
}

// Helper to register and track escrow contract
async function trackEscrowContract(
  context: any,
  chainId: number,
  escrowAddress: string
) {
  if (!escrowContracts.has(chainId.toString())) {
    escrowContracts.set(chainId.toString(), new Set());
  }
  
  const chainEscrows = escrowContracts.get(chainId.toString())!;
  if (!chainEscrows.has(escrowAddress)) {
    chainEscrows.add(escrowAddress);
    console.log(`Discovered new escrow contract on chain ${chainId}: ${escrowAddress}`);
    
    // Dynamically watch for events from this escrow
    // Note: In Ponder v0.12, we need to handle this differently
    // We'll filter events by address in our handlers
  }
}

// Handle SrcEscrowCreated events from Factory
ponder.on("CrossChainEscrowFactory:SrcEscrowCreated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { srcImmutables, dstImmutablesComplement } = event.args;
  
  // Calculate the escrow address (placeholder for now)
  const escrowAddress = calculateCreate2Address(
    event.log.address,
    srcImmutables.hashlock,
    "0x" // init code hash
  );
  
  // Track this escrow for future event handling
  await trackEscrowContract(context, chainId, escrowAddress);
  
  const id = `${chainId}-${escrowAddress}`;
  
  // Insert SrcEscrow record
  await context.db.insert(srcEscrow).values({
    id,
    chainId,
    escrowAddress,
    orderHash: srcImmutables.orderHash,
    hashlock: srcImmutables.hashlock,
    maker: decodeAddress(srcImmutables.maker),
    taker: decodeAddress(srcImmutables.taker),
    srcToken: decodeAddress(srcImmutables.token),
    srcAmount: srcImmutables.amount,
    srcSafetyDeposit: srcImmutables.safetyDeposit,
    dstMaker: decodeAddress(dstImmutablesComplement.maker),
    dstToken: decodeAddress(dstImmutablesComplement.token),
    dstAmount: dstImmutablesComplement.amount,
    dstSafetyDeposit: dstImmutablesComplement.safetyDeposit,
    dstChainId: dstImmutablesComplement.chainId,
    timelocks: srcImmutables.timelocks,
    createdAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    status: "created",
  });
  
  // Update/create AtomicSwap record
  await context.db
    .insert(atomicSwap)
    .values({
      id: srcImmutables.orderHash,
      orderHash: srcImmutables.orderHash,
      hashlock: srcImmutables.hashlock,
      srcChainId: chainId,
      dstChainId: Number(dstImmutablesComplement.chainId),
      srcEscrowAddress: escrowAddress,
      srcMaker: decodeAddress(srcImmutables.maker),
      srcTaker: decodeAddress(srcImmutables.taker),
      dstMaker: decodeAddress(dstImmutablesComplement.maker),
      dstTaker: decodeAddress(srcImmutables.taker),
      srcToken: decodeAddress(srcImmutables.token),
      srcAmount: srcImmutables.amount,
      dstToken: decodeAddress(dstImmutablesComplement.token),
      dstAmount: dstImmutablesComplement.amount,
      srcSafetyDeposit: srcImmutables.safetyDeposit,
      dstSafetyDeposit: dstImmutablesComplement.safetyDeposit,
      timelocks: srcImmutables.timelocks,
      status: "src_created",
      srcCreatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      srcChainId: chainId,
      srcEscrowAddress: escrowAddress,
      srcMaker: decodeAddress(srcImmutables.maker),
      srcTaker: decodeAddress(srcImmutables.taker),
      srcToken: decodeAddress(srcImmutables.token),
      srcAmount: srcImmutables.amount,
      srcSafetyDeposit: srcImmutables.safetyDeposit,
      status: row.dstEscrowAddress ? "both_created" : "src_created",
      srcCreatedAt: event.block.timestamp,
    }));
  
  // Update chain statistics
  await context.db
    .insert(chainStatistics)
    .values({
      id: chainId.toString(),
      chainId: chainId,
      totalSrcEscrows: 1n,
      totalDstEscrows: 0n,
      totalWithdrawals: 0n,
      totalCancellations: 0n,
      totalVolumeLocked: srcImmutables.amount,
      totalVolumeWithdrawn: 0n,
      lastUpdatedBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      totalSrcEscrows: row.totalSrcEscrows + 1n,
      totalVolumeLocked: row.totalVolumeLocked + srcImmutables.amount,
      lastUpdatedBlock: event.block.number,
    }));
});

// Handle DstEscrowCreated events from Factory
ponder.on("CrossChainEscrowFactory:DstEscrowCreated", async ({ event, context }) => {
  const chainId = context.chain.id;
  const { escrow, hashlock, taker } = event.args;
  
  // Track this escrow for future event handling
  await trackEscrowContract(context, chainId, escrow);
  
  const id = `${chainId}-${escrow}`;
  
  // Insert DstEscrow record
  await context.db.insert(dstEscrow).values({
    id,
    chainId,
    escrowAddress: escrow,
    hashlock,
    taker: decodeAddress(taker),
    srcCancellationTimestamp: 0n,
    createdAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    status: "created",
  });
  
  // Update AtomicSwap record
  const existingSwaps = await context.db
    .select(atomicSwap, { 
      where: (row) => row.hashlock === hashlock 
    });
  
  if (existingSwaps.length > 0) {
    const existingSwap = existingSwaps[0];
    await context.db
      .update(atomicSwap, { id: existingSwap.id })
      .set({
        dstChainId: chainId,
        dstEscrowAddress: escrow,
        dstTaker: decodeAddress(taker),
        status: existingSwap.status === "src_created" ? "both_created" : "dst_created",
        dstCreatedAt: event.block.timestamp,
      });
  }
  
  // Update chain statistics
  await context.db
    .insert(chainStatistics)
    .values({
      id: chainId.toString(),
      chainId: chainId,
      totalSrcEscrows: 0n,
      totalDstEscrows: 1n,
      totalWithdrawals: 0n,
      totalCancellations: 0n,
      totalVolumeLocked: 0n,
      totalVolumeWithdrawn: 0n,
      lastUpdatedBlock: event.block.number,
    })
    .onConflictDoUpdate((row) => ({
      totalDstEscrows: row.totalDstEscrows + 1n,
      lastUpdatedBlock: event.block.number,
    }));
});

// Since we can't use factory pattern, we need to manually query escrow events
// We'll do this by checking if the event comes from a tracked escrow address
async function isTrackedEscrow(chainId: number, address: string): boolean {
  const chainEscrows = escrowContracts.get(chainId.toString());
  return chainEscrows ? chainEscrows.has(address) : false;
}

// Generic handler for escrow events
// This would need to be implemented differently in Ponder v0.12
// as we can't dynamically register event handlers

// For now, we'll need to manually check escrow addresses in the database
async function handleEscrowEvent(
  event: any,
  context: any,
  eventType: "withdrawal" | "cancellation" | "rescue"
) {
  const chainId = context.chain.id;
  const escrowAddress = event.log.address;
  
  // Check if this is a known escrow from our database
  const srcEscrowId = `${chainId}-${escrowAddress}`;
  const srcEscrowRecord = await context.db.find(srcEscrow, { id: srcEscrowId });
  const dstEscrowId = `${chainId}-${escrowAddress}`;
  const dstEscrowRecord = await context.db.find(dstEscrow, { id: dstEscrowId });
  
  if (!srcEscrowRecord && !dstEscrowRecord) {
    // This event is from an unknown escrow, ignore it
    return;
  }
  
  // Process the event based on type
  switch (eventType) {
    case "withdrawal":
      // Handle withdrawal logic
      break;
    case "cancellation":
      // Handle cancellation logic
      break;
    case "rescue":
      // Handle rescue logic
      break;
  }
}