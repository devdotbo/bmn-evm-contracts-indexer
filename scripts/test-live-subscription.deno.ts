#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Test Live Data Subscription using @ponder/client
 * 
 * This script demonstrates real-time data subscriptions via Server-Sent Events (SSE)
 * from the Ponder indexer using SQL over HTTP.
 * 
 * Run: deno run --allow-net --allow-env --allow-read scripts/test-live-subscription.deno.ts
 */

import { createClient, eq, desc, and, or } from "npm:@ponder/client@0.12.0";
import * as schema from "../ponder.schema.ts";

const PONDER_URL = Deno.env.get("PONDER_URL") || "http://localhost:42069";
const RESOLVER_ADDRESS = "0xfdF1dDeB176BEA06c7430166e67E615bC312b7B5"; // Example resolver address

console.log("🔴 Live Data Subscription Test");
console.log(`📍 Server: ${PONDER_URL}`);
console.log(`👤 Monitoring Address: ${RESOLVER_ADDRESS}`);
console.log("=".repeat(50));

async function testLiveSubscriptions() {
  try {
    // Create client
    const client = createClient(`${PONDER_URL}/sql`, { schema });
    console.log("✅ Client created successfully\n");

    // Store unsubscribe functions
    const unsubscribers: Array<() => void> = [];

    // 1. Live subscription to atomic swaps
    console.log("📡 Subscribing to atomic swaps...");
    const { unsubscribe: unsubSwaps } = client.live(
      (db) => db
        .select()
        .from(schema.atomicSwap)
        .orderBy(desc(schema.atomicSwap.srcCreatedAt))
        .limit(10)
        .execute(),
      (data) => {
        console.log(`\n🔄 [Atomic Swaps Update] ${new Date().toISOString()}`);
        console.log(`  Total swaps: ${data.length}`);
        data.forEach((swap: any, i: number) => {
          console.log(`  ${i + 1}. Order: ${swap.orderHash?.slice(0, 10)}...`);
          console.log(`     Status: ${swap.status}`);
          console.log(`     Src Chain: ${swap.srcChainId} → Dst Chain: ${swap.dstChainId}`);
          console.log(`     Src: ${swap.srcAmount} @ ${swap.srcToken?.slice(0, 10)}...`);
          console.log(`     Dst: ${swap.dstAmount} @ ${swap.dstToken?.slice(0, 10)}...`);
        });
      },
      (error) => {
        console.error("❌ Atomic swap subscription error:", error);
      }
    );
    unsubscribers.push(unsubSwaps);

    // 2. Live subscription to source escrows
    console.log("📡 Subscribing to source escrows...");
    const { unsubscribe: unsubSrc } = client.live(
      (db) => db
        .select()
        .from(schema.srcEscrow)
        .where(eq(schema.srcEscrow.status, "created"))
        .orderBy(desc(schema.srcEscrow.createdAt))
        .limit(10)
        .execute(),
      (data) => {
        console.log(`\n🔄 [Source Escrows Update] ${new Date().toISOString()}`);
        console.log(`  Active escrows: ${data.length}`);
        data.forEach((escrow: any, i: number) => {
          console.log(`  ${i + 1}. Escrow: ${escrow.escrowAddress?.slice(0, 10)}...`);
          console.log(`     Order: ${escrow.orderHash?.slice(0, 10)}...`);
          console.log(`     Maker: ${escrow.maker?.slice(0, 10)}... → Taker: ${escrow.taker?.slice(0, 10)}...`);
          console.log(`     Amount: ${escrow.srcAmount} + ${escrow.srcSafetyDeposit} (deposit)`);
        });
      },
      (error) => {
        console.error("❌ Source escrow subscription error:", error);
      }
    );
    unsubscribers.push(unsubSrc);

    // 3. Live subscription to destination escrows
    console.log("📡 Subscribing to destination escrows...");
    const { unsubscribe: unsubDst } = client.live(
      (db) => db
        .select()
        .from(schema.dstEscrow)
        .where(eq(schema.dstEscrow.status, "created"))
        .orderBy(desc(schema.dstEscrow.createdAt))
        .limit(10)
        .execute(),
      (data) => {
        console.log(`\n🔄 [Destination Escrows Update] ${new Date().toISOString()}`);
        console.log(`  Active escrows: ${data.length}`);
        data.forEach((escrow: any, i: number) => {
          console.log(`  ${i + 1}. Escrow: ${escrow.escrowAddress?.slice(0, 10)}...`);
          console.log(`     Hashlock: ${escrow.hashlock?.slice(0, 10)}...`);
          console.log(`     Taker: ${escrow.taker?.slice(0, 10)}...`);
          console.log(`     Cancellation Time: ${escrow.srcCancellationTimestamp}`);
        });
      },
      (error) => {
        console.error("❌ Destination escrow subscription error:", error);
      }
    );
    unsubscribers.push(unsubDst);

    // 4. Live subscription to chain statistics
    console.log("📡 Subscribing to chain statistics...");
    const { unsubscribe: unsubStats } = client.live(
      (db) => db
        .select()
        .from(schema.chainStatistics)
        .execute(),
      (data) => {
        console.log(`\n🔄 [Chain Statistics Update] ${new Date().toISOString()}`);
        data.forEach((stat: any) => {
          console.log(`  Chain ${stat.chainId}:`);
          console.log(`    Src Escrows: ${stat.totalSrcEscrows || 0}`);
          console.log(`    Dst Escrows: ${stat.totalDstEscrows || 0}`);
          console.log(`    Withdrawals: ${stat.totalWithdrawals || 0}`);
          console.log(`    Cancellations: ${stat.totalCancellations || 0}`);
          console.log(`    Volume: ${stat.totalVolume || 0}`);
        });
      },
      (error) => {
        console.error("❌ Chain statistics subscription error:", error);
      }
    );
    unsubscribers.push(unsubStats);

    // 5. Live subscription to recent withdrawals
    console.log("📡 Subscribing to withdrawal events...");
    const { unsubscribe: unsubWithdrawals } = client.live(
      (db) => db
        .select()
        .from(schema.escrowWithdrawal)
        .orderBy(desc(schema.escrowWithdrawal.withdrawnAt))
        .limit(5)
        .execute(),
      (data) => {
        console.log(`\n🔄 [Recent Withdrawals Update] ${new Date().toISOString()}`);
        console.log(`  Last ${data.length} withdrawals:`);
        data.forEach((withdrawal: any, i: number) => {
          console.log(`  ${i + 1}. Escrow: ${withdrawal.escrowAddress?.slice(0, 10)}...`);
          console.log(`     Secret: ${withdrawal.secret?.slice(0, 10)}...`);
          console.log(`     Chain: ${withdrawal.chainId}, Block: ${withdrawal.blockNumber}`);
          console.log(`     Tx: ${withdrawal.transactionHash?.slice(0, 10)}...`);
        });
      },
      (error) => {
        console.error("❌ Withdrawal subscription error:", error);
      }
    );
    unsubscribers.push(unsubWithdrawals);

    // 6. Live subscription to BMN token holders
    console.log("📡 Subscribing to BMN token holders...");
    const { unsubscribe: unsubHolders } = client.live(
      (db) => db
        .select()
        .from(schema.bmnTokenHolder)
        .orderBy(desc(schema.bmnTokenHolder.balance))
        .limit(5)
        .execute(),
      (data) => {
        console.log(`\n🔄 [Top BMN Holders Update] ${new Date().toISOString()}`);
        console.log(`  Top ${data.length} holders:`);
        data.forEach((holder: any, i: number) => {
          console.log(`  ${i + 1}. Address: ${holder.id?.slice(0, 10)}...`);
          console.log(`     Balance: ${holder.balance}`);
          console.log(`     Chain: ${holder.chainId}`);
        });
      },
      (error) => {
        console.error("❌ BMN holder subscription error:", error);
      }
    );
    unsubscribers.push(unsubHolders);

    // 7. Live subscription to recent BMN transfers
    console.log("📡 Subscribing to BMN token transfers...");
    const { unsubscribe: unsubTransfers } = client.live(
      (db) => db
        .select()
        .from(schema.bmnTransfer)
        .orderBy(desc(schema.bmnTransfer.timestamp))
        .limit(5)
        .execute(),
      (data) => {
        console.log(`\n🔄 [Recent BMN Transfers Update] ${new Date().toISOString()}`);
        console.log(`  Last ${data.length} transfers:`);
        data.forEach((transfer: any, i: number) => {
          console.log(`  ${i + 1}. From: ${transfer.from?.slice(0, 10)}... → To: ${transfer.to?.slice(0, 10)}...`);
          console.log(`     Amount: ${transfer.value}`);
          console.log(`     Chain: ${transfer.chainId}, Block: ${transfer.blockNumber}`);
        });
      },
      (error) => {
        console.error("❌ BMN transfer subscription error:", error);
      }
    );
    unsubscribers.push(unsubTransfers);

    console.log("\n✨ All subscriptions active!");
    console.log("📊 Monitoring 7 live data streams:");
    console.log("   1. Atomic Swaps (all statuses)");
    console.log("   2. Source Escrows (created status)");
    console.log("   3. Destination Escrows (created status)");
    console.log("   4. Chain Statistics");
    console.log("   5. Recent Withdrawals");
    console.log("   6. Top BMN Token Holders");
    console.log("   7. Recent BMN Transfers");
    console.log("\n⏳ Listening for updates... (Press Ctrl+C to stop)\n");
    console.log("💡 Tip: Create transactions on the blockchain to see live updates!");

    // Handle graceful shutdown
    const handleShutdown = () => {
      console.log("\n\n🛑 Shutting down subscriptions...");
      unsubscribers.forEach(unsub => unsub());
      console.log("✅ All subscriptions closed");
      Deno.exit(0);
    };

    // Register signal handlers
    Deno.addSignalListener("SIGINT", handleShutdown);
    Deno.addSignalListener("SIGTERM", handleShutdown);

    // Keep the script running
    await new Promise(() => {});

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
    Deno.exit(1);
  }
}

// Run the test
console.log("🚀 Starting live subscription test...\n");
await testLiveSubscriptions();