/**
 * Test the SQL over HTTP using proper @ponder/client
 * This demonstrates the correct usage with the actual client library
 */

import { createClient, desc, eq } from "@ponder/client";
// Import the compiled schema - must run pnpm codegen first
import * as schema from "../ponder.schema.js";

const PONDER_URL = process.env.PONDER_URL || "http://localhost:42069";

async function main() {
  console.log("🔍 Testing SQL over HTTP with @ponder/client");
  console.log(`📍 Server: ${PONDER_URL}`);
  console.log("=".repeat(50));

  const client = createClient(`${PONDER_URL}/sql`);
  
  try {
    // Test 1: Query src_escrow table
    console.log("\n📊 Test 1: Querying srcEscrow table...");
    const srcEscrows = await client.db
      .select()
      .from(schema.srcEscrow)
      .limit(5);
    
    console.log(`  ✅ Found ${srcEscrows.length} source escrows`);
    if (srcEscrows.length > 0) {
      console.log("  Sample:", srcEscrows[0]);
    }

    // Test 2: Query with where clause
    console.log("\n📊 Test 2: Query active escrows...");
    const activeEscrows = await client.db
      .select()
      .from(schema.srcEscrow)
      .where(eq(schema.srcEscrow.status, "Active"))
      .limit(5);
    
    console.log(`  ✅ Found ${activeEscrows.length} active escrows`);

    // Test 3: Query chain statistics
    console.log("\n📊 Test 3: Query chain statistics...");
    const stats = await client.db
      .select()
      .from(schema.chainStatistics);
    
    console.log(`  ✅ Found stats for ${stats.length} chains`);
    stats.forEach(stat => {
      console.log(`  Chain ${stat.chain}:`, {
        srcEscrows: stat.totalSrcEscrows,
        withdrawals: stat.totalWithdrawals
      });
    });

    // Test 4: Query BMN token holders
    console.log("\n📊 Test 4: Query BMN token holders...");
    const holders = await client.db
      .select()
      .from(schema.bmnTokenHolder)
      .where(eq(schema.bmnTokenHolder.chainId, 8453))
      .limit(10);
    
    console.log(`  ✅ Found ${holders.length} holders on Base`);

    // Test 5: Live query subscription
    console.log("\n📊 Test 5: Testing live queries...");
    const unsubscribe = await client.live(
      (db) => db.select().from(schema.chainStatistics),
      (result) => {
        console.log("  📡 Live update received!");
        result.forEach(stat => {
          console.log(`    Chain ${stat.chain}: ${stat.totalSrcEscrows} escrows`);
        });
      }
    );

    // Wait for a few seconds to see if any updates come through
    console.log("  ⏳ Waiting 5 seconds for live updates...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    unsubscribe();
    console.log("  ✅ Live query test completed");

    console.log("\n✨ All tests completed successfully!");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);