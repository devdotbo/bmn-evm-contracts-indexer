#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Test client for SQL over HTTP functionality using Deno
 * This demonstrates the correct way to query Ponder's SQL endpoint
 * 
 * Run with: deno run --allow-net --allow-env --allow-read scripts/test-sql-client.deno.ts
 */

// Configuration
const PONDER_URL = Deno.env.get("PONDER_URL") || "http://localhost:42069";
const SQL_ENDPOINT = `${PONDER_URL}/sql`;

console.log("🔍 Testing SQL over HTTP Client with Deno");
console.log(`📍 Endpoint: ${SQL_ENDPOINT}`);
console.log("=".repeat(50));

interface QueryResponse {
  data: any[];
  error?: string;
}

async function executeSqlQuery(query: string): Promise<QueryResponse> {
  try {
    const response = await fetch(SQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Query execution error:", error);
    throw error;
  }
}

async function testSqlQueries() {
  try {
    // Test 1: Query SrcEscrow table
    console.log("\n📊 Test 1: Querying src_escrow table...");
    const srcEscrowQuery = "SELECT * FROM src_escrow LIMIT 5";
    const srcEscrows = await executeSqlQuery(srcEscrowQuery);
    
    if (srcEscrows.error) {
      console.error("  ❌ Error:", srcEscrows.error);
    } else {
      console.log(`  ✅ Found ${srcEscrows.data.length} source escrows`);
      if (srcEscrows.data.length > 0) {
        console.log("  Sample escrow:", {
          id: srcEscrows.data[0].id,
          chainId: srcEscrows.data[0].chainId,
          status: srcEscrows.data[0].status,
        });
      }
    }

    // Test 2: Query DstEscrow table
    console.log("\n📊 Test 2: Querying dst_escrow table...");
    const dstEscrowQuery = "SELECT * FROM dst_escrow LIMIT 5";
    const dstEscrows = await executeSqlQuery(dstEscrowQuery);
    
    if (dstEscrows.error) {
      console.error("  ❌ Error:", dstEscrows.error);
    } else {
      console.log(`  ✅ Found ${dstEscrows.data.length} destination escrows`);
    }

    // Test 3: Query AtomicSwap table
    console.log("\n📊 Test 3: Querying atomic_swap table...");
    const swapQuery = "SELECT * FROM atomic_swap LIMIT 5";
    const swaps = await executeSqlQuery(swapQuery);
    
    if (swaps.error) {
      console.error("  ❌ Error:", swaps.error);
    } else {
      console.log(`  ✅ Found ${swaps.data.length} atomic swaps`);
    }

    // Test 4: Query ChainStatistics
    console.log("\n📊 Test 4: Querying chain_statistics...");
    const statsQuery = "SELECT * FROM chain_statistics";
    const stats = await executeSqlQuery(statsQuery);
    
    if (stats.error) {
      console.error("  ❌ Error:", stats.error);
    } else {
      console.log(`  ✅ Found statistics for ${stats.data.length} chains`);
      stats.data.forEach((stat: any) => {
        console.log(`  Chain ${stat.chain}:`, {
          totalSrcEscrows: stat.totalSrcEscrows,
          totalDstEscrows: stat.totalDstEscrows,
          totalWithdrawals: stat.totalWithdrawals,
          totalCancellations: stat.totalCancellations,
        });
      });
    }

    // Test 5: Query BMN Token data
    console.log("\n📊 Test 5: Querying BMN token holders...");
    const holdersQuery = "SELECT * FROM bmn_token_holder LIMIT 10";
    const holders = await executeSqlQuery(holdersQuery);
    
    if (holders.error) {
      console.error("  ❌ Error:", holders.error);
    } else {
      console.log(`  ✅ Found ${holders.data.length} BMN token holders`);
    }

    // Test 6: Complex query with JOIN
    console.log("\n📊 Test 6: Testing complex queries with conditions...");
    const complexQuery = `
      SELECT 
        se.id,
        se.chainId,
        se.escrowAddress,
        se.status,
        se.srcAmount,
        se.dstAmount
      FROM src_escrow se
      WHERE se.status = 'Active'
      LIMIT 5
    `;
    const activeEscrows = await executeSqlQuery(complexQuery);
    
    if (activeEscrows.error) {
      console.error("  ❌ Error:", activeEscrows.error);
    } else {
      console.log(`  ✅ Found ${activeEscrows.data.length} active source escrows`);
    }

    // Test 7: Aggregation query
    console.log("\n📊 Test 7: Testing aggregation queries...");
    const aggregationQuery = `
      SELECT 
        chainId,
        COUNT(*) as total_escrows,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_escrows,
        COUNT(CASE WHEN status = 'Withdrawn' THEN 1 END) as withdrawn_escrows
      FROM src_escrow
      GROUP BY chainId
    `;
    const aggregation = await executeSqlQuery(aggregationQuery);
    
    if (aggregation.error) {
      console.error("  ❌ Error:", aggregation.error);
    } else {
      console.log(`  ✅ Aggregation results:`);
      aggregation.data.forEach((row: any) => {
        console.log(`    Chain ${row.chainId}: ${row.total_escrows} total, ${row.active_escrows} active, ${row.withdrawn_escrows} withdrawn`);
      });
    }

    console.log("\n✅ All SQL over HTTP tests completed!");
    
  } catch (error) {
    console.error("\n❌ Fatal error during testing:", error);
    Deno.exit(1);
  }
}

// Test with @ponder/client style API endpoint
async function testPonderClientApi() {
  console.log("\n" + "=".repeat(50));
  console.log("📦 Testing @ponder/client compatible API...");
  
  try {
    // The @ponder/client sends queries in a specific format
    const clientQuery = {
      method: "query",
      query: "SELECT * FROM src_escrow LIMIT 3",
    };

    const response = await fetch(`${SQL_ENDPOINT}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clientQuery),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Client API query successful:", result);
    } else {
      console.log(`⚠️  Client API returned status ${response.status}`);
      const text = await response.text();
      console.log("Response:", text);
    }
  } catch (error) {
    console.log("⚠️  Client API test failed (this might be expected):", error);
  }
}

// Main execution
console.log("\n🚀 Starting SQL over HTTP tests...\n");

await testSqlQueries();
await testPonderClientApi();

console.log("\n" + "=".repeat(50));
console.log("🎉 Test suite completed!");