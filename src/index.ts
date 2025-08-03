import { ponder } from "ponder:registry";
import { 
  SrcEscrow, 
  DstEscrow, 
  EscrowWithdrawal, 
  EscrowCancellation, 
  FundsRescued, 
  AtomicSwap,
  ChainStatistics 
} from "ponder:schema";
import { formatUnits, getAddress, keccak256, encodePacked, decodeEventLog } from "viem";
import { calculateEscrowAddress } from "./utils/addressCalculation";
import BaseEscrowAbi from "../abis/BaseEscrow.json";

// Helper function to decode packed address from uint256
function decodeAddress(packedAddress: bigint): string {
  // Extract the lower 160 bits (20 bytes) which contain the address
  const address = packedAddress & ((1n << 160n) - 1n);
  return getAddress(`0x${address.toString(16).padStart(40, '0')}`);
}

// Clone proxy init code prefix (EIP-1167 minimal proxy)
const CLONE_PROXY_PREFIX = "0x3d602d80600a3d3981f3363d3d373d3d3d363d73" as const;
const CLONE_PROXY_SUFFIX = "0x5af43d82803e903d91602b57fd5bf3" as const;

// Helper function to process BaseEscrow events from transaction logs
async function processSrcEscrowEvent(
  log: any,
  escrowAddress: string,
  chainId: number,
  context: any
) {
  try {
    const decodedLog = decodeEventLog({
      abi: BaseEscrowAbi.abi,
      data: log.data,
      topics: log.topics,
    });

    // Process based on event name
    switch (decodedLog.eventName) {
      case "EscrowWithdrawal": {
        const { secret } = decodedLog.args;
        const id = `${chainId}-${escrowAddress}-${log.transactionHash}`;
        
        // Insert withdrawal record
        await context.db.insert(EscrowWithdrawal).values({
          id,
          chainId,
          escrowAddress,
          secret,
          withdrawnAt: log.blockTimestamp || Date.now(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        });
        
        // Update SrcEscrow status
        const srcEscrowId = `${chainId}-${escrowAddress}`;
        const srcEscrow = await context.db.find(SrcEscrow, { id: srcEscrowId });
        
        if (srcEscrow) {
          await context.db
            .update(SrcEscrow, { id: srcEscrowId })
            .set({ status: "withdrawn" });
          
          // Update AtomicSwap
          await context.db
            .update(AtomicSwap, { id: srcEscrow.orderHash })
            .set({
              status: "completed",
              completedAt: log.blockTimestamp || Date.now(),
              secret,
            });
          
          // Update statistics
          await context.db
            .update(ChainStatistics, { id: chainId.toString() })
            .set((row) => ({
              totalWithdrawals: row.totalWithdrawals + 1n,
              totalVolumeWithdrawn: row.totalVolumeWithdrawn + srcEscrow.srcAmount,
              lastUpdatedBlock: log.blockNumber,
            }));
        }
        break;
      }
      
      case "EscrowCancelled": {
        const id = `${chainId}-${escrowAddress}-${log.transactionHash}`;
        
        // Insert cancellation record
        await context.db.insert(EscrowCancellation).values({
          id,
          chainId,
          escrowAddress,
          cancelledAt: log.blockTimestamp || Date.now(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        });
        
        // Update SrcEscrow status
        const srcEscrowId = `${chainId}-${escrowAddress}`;
        const srcEscrow = await context.db.find(SrcEscrow, { id: srcEscrowId });
        
        if (srcEscrow) {
          await context.db
            .update(SrcEscrow, { id: srcEscrowId })
            .set({ status: "cancelled" });
          
          // Update AtomicSwap
          await context.db
            .update(AtomicSwap, { id: srcEscrow.orderHash })
            .set({
              status: "cancelled",
              cancelledAt: log.blockTimestamp || Date.now(),
            });
        }
        
        // Update statistics
        await context.db
          .update(ChainStatistics, { id: chainId.toString() })
          .set((row) => ({
            totalCancellations: row.totalCancellations + 1n,
            lastUpdatedBlock: log.blockNumber,
          }));
        break;
      }
      
      case "FundsRescued": {
        const { token, amount } = decodedLog.args;
        const id = `${chainId}-${escrowAddress}-${log.transactionHash}-${log.logIndex || 0}`;
        
        // Insert funds rescued record
        await context.db.insert(FundsRescued).values({
          id,
          chainId,
          escrowAddress,
          token,
          amount,
          rescuedAt: log.blockTimestamp || Date.now(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex || 0,
        });
        
        // Update statistics
        await context.db
          .update(ChainStatistics, { id: chainId.toString() })
          .set((row) => ({
            lastUpdatedBlock: log.blockNumber,
          }));
        break;
      }
    }
  } catch (error) {
    // Log could not be decoded or is not a BaseEscrow event
    console.debug(`Could not decode log from ${escrowAddress}:`, error);
  }
}

// Initialize chain statistics
ponder.on("setup", async ({ context }) => {
  const chains = [8453, 42793]; // Base and Etherlink
  
  for (const chainId of chains) {
    await context.db
      .insert(ChainStatistics)
      .values({
        id: chainId.toString(),
        chainId: chainId,
        totalSrcEscrows: 0n,
        totalDstEscrows: 0n,
        totalWithdrawals: 0n,
        totalCancellations: 0n,
        totalVolumeLocked: 0n,
        totalVolumeWithdrawn: 0n,
        lastUpdatedBlock: 0n,
      })
      .onConflictDoNothing();
  }
});

// Handle SrcEscrowCreated events from Factory
ponder.on("CrossChainEscrowFactory:SrcEscrowCreated", async ({ event, context }) => {
  const chainId = context.network.chainId;
  const { srcImmutables, dstImmutablesComplement } = event.args;
  
  // Calculate the escrow address using CREATE2
  // The salt is derived from the immutables struct
  const salt = keccak256(
    encodePacked(
      ["bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
      [
        srcImmutables.orderHash,
        srcImmutables.hashlock,
        srcImmutables.maker,
        srcImmutables.taker,
        srcImmutables.token,
        srcImmutables.amount,
        srcImmutables.safetyDeposit,
        srcImmutables.timelocks
      ]
    )
  );
  
  // Get the SRC implementation address from environment
  const srcImplementation = process.env.BMN_SRC_IMPLEMENTATION || "0x77CC1A51dC5855bcF0d9f1c1FceaeE7fb855a535";
  
  // Build the complete init code for the clone proxy
  const initCode = encodePacked(
    ["bytes", "address", "bytes"],
    [CLONE_PROXY_PREFIX, srcImplementation as `0x${string}`, CLONE_PROXY_SUFFIX]
  );
  
  // Calculate the CREATE2 address
  const escrowAddress = calculateEscrowAddress(
    event.log.address, // Factory address
    srcImplementation,
    salt,
    initCode
  );
  
  const id = `${chainId}-${escrowAddress}`;
  
  // Insert SrcEscrow record
  await context.db.insert(SrcEscrow).values({
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
  
  // Create or update AtomicSwap record
  await context.db
    .insert(AtomicSwap)
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
      dstTaker: decodeAddress(srcImmutables.taker), // Assuming same taker on both chains
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
    .onConflictDoUpdate({
      srcChainId: chainId,
      srcEscrowAddress: escrowAddress,
      status: "src_created",
      srcCreatedAt: event.block.timestamp,
    });
  
  // Update chain statistics
  await context.db
    .update(ChainStatistics, { id: chainId.toString() })
    .set((row) => ({
      totalSrcEscrows: row.totalSrcEscrows + 1n,
      totalVolumeLocked: row.totalVolumeLocked + srcImmutables.amount,
      lastUpdatedBlock: event.block.number,
    }));
  
  // Parse transaction logs to check for BaseEscrow events in the same transaction
  // This allows us to capture events from SrcEscrow contracts even though
  // we can't use the factory pattern for them
  if (event.transactionReceipt) {
    const escrowLogs = event.transactionReceipt.logs.filter(
      log => log.address.toLowerCase() === escrowAddress.toLowerCase()
    );
    
    // Process any BaseEscrow events from the created escrow
    for (const log of escrowLogs) {
      await processSrcEscrowEvent(log, escrowAddress, chainId, context);
    }
  }
});

// Handle DstEscrowCreated events from Factory
ponder.on("CrossChainEscrowFactory:DstEscrowCreated", async ({ event, context }) => {
  const chainId = context.network.chainId;
  const { escrow, hashlock, taker } = event.args;
  
  const id = `${chainId}-${escrow}`;
  
  // Insert DstEscrow record
  await context.db.insert(DstEscrow).values({
    id,
    chainId,
    escrowAddress: escrow,
    hashlock,
    taker: decodeAddress(taker),
    srcCancellationTimestamp: 0n, // Will be set when we have more info
    createdAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    status: "created",
  });
  
  // Update AtomicSwap record
  const atomicSwap = await context.db.find(AtomicSwap, { hashlock });
  if (atomicSwap) {
    await context.db
      .update(AtomicSwap, { id: atomicSwap.orderHash })
      .set({
        dstChainId: chainId,
        dstEscrowAddress: escrow,
        status: "dst_created",
        dstCreatedAt: event.block.timestamp,
      });
  }
  
  // Update chain statistics
  await context.db
    .update(ChainStatistics, { id: chainId.toString() })
    .set((row) => ({
      totalDstEscrows: row.totalDstEscrows + 1n,
      lastUpdatedBlock: event.block.number,
    }));
});

// Handle EscrowWithdrawal events from DstEscrow contracts
ponder.on("DstEscrow:EscrowWithdrawal", async ({ event, context }) => {
  const chainId = context.network.chainId;
  const escrowAddress = event.log.address;
  const { secret } = event.args;
  
  const id = `${chainId}-${escrowAddress}-${event.transaction.hash}`;
  
  // Insert withdrawal record
  await context.db.insert(EscrowWithdrawal).values({
    id,
    chainId,
    escrowAddress,
    secret,
    withdrawnAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
  
  // Update DstEscrow status
  const dstEscrowId = `${chainId}-${escrowAddress}`;
  const dstEscrow = await context.db.find(DstEscrow, { id: dstEscrowId });
  
  if (dstEscrow) {
    await context.db
      .update(DstEscrow, { id: dstEscrowId })
      .set({ status: "withdrawn" });
    
    // Update AtomicSwap if we can find it by hashlock
    const atomicSwap = await context.db.find(AtomicSwap, { hashlock: dstEscrow.hashlock });
    if (atomicSwap) {
      await context.db
        .update(AtomicSwap, { id: atomicSwap.orderHash })
        .set({
          status: "completed",
          completedAt: event.block.timestamp,
          secret,
        });
    }
    
    // Update statistics
    await context.db
      .update(ChainStatistics, { id: chainId.toString() })
      .set((row) => ({
        totalWithdrawals: row.totalWithdrawals + 1n,
        lastUpdatedBlock: event.block.number,
      }));
  }
});

// Handle EscrowCancelled events from DstEscrow contracts
ponder.on("DstEscrow:EscrowCancelled", async ({ event, context }) => {
  const chainId = context.network.chainId;
  const escrowAddress = event.log.address;
  
  const id = `${chainId}-${escrowAddress}-${event.transaction.hash}`;
  
  // Insert cancellation record
  await context.db.insert(EscrowCancellation).values({
    id,
    chainId,
    escrowAddress,
    cancelledAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
  
  // Update DstEscrow status
  const dstEscrowId = `${chainId}-${escrowAddress}`;
  const dstEscrow = await context.db.find(DstEscrow, { id: dstEscrowId });
  
  if (dstEscrow) {
    await context.db
      .update(DstEscrow, { id: dstEscrowId })
      .set({ status: "cancelled" });
  }
  
  // Update statistics
  await context.db
    .update(ChainStatistics, { id: chainId.toString() })
    .set((row) => ({
      totalCancellations: row.totalCancellations + 1n,
      lastUpdatedBlock: event.block.number,
    }));
});

// Handle FundsRescued events from DstEscrow contracts
ponder.on("DstEscrow:FundsRescued", async ({ event, context }) => {
  const chainId = context.network.chainId;
  const escrowAddress = event.log.address;
  const { token, amount } = event.args;
  
  const id = `${chainId}-${escrowAddress}-${event.transaction.hash}-${event.log.logIndex}`;
  
  // Insert funds rescued record
  await context.db.insert(FundsRescued).values({
    id,
    chainId,
    escrowAddress,
    token,
    amount,
    rescuedAt: event.block.timestamp,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    logIndex: event.log.logIndex || 0,
  });
  
  // Update statistics
  await context.db
    .update(ChainStatistics, { id: chainId.toString() })
    .set((row) => ({
      lastUpdatedBlock: event.block.number,
    }));
});

// For SrcEscrow events, we need to handle them differently since we can't use the factory pattern
// We'll need to parse events from transactions that created SrcEscrows
// This requires tracking escrow addresses when they're created and checking logs in those transactions
