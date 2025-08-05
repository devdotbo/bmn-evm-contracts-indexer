#!/usr/bin/env node

/**
 * RPC Endpoint Testing Script
 * 
 * This script tests all configured Etherlink RPC endpoints for:
 * - Basic connectivity and health
 * - Block range limits for eth_getLogs
 * - Performance and latency
 * - Rate limit handling
 */

import { createPublicClient, http } from "viem";
import { etherlink } from "viem/chains";
import dotenv from "dotenv";
import { 
  checkRpcHealth, 
  testBlockRangeLimit, 
  logHealthStatus,
  getEndpointMetrics,
  type RpcHealthStatus 
} from "../src/utils/rpc-monitor";

// Load environment variables
dotenv.config();

// Contract address for testing eth_getLogs
const TEST_CONTRACT = "0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1";

interface RpcEndpointConfig {
  name: string;
  url: string;
  expectedBlockLimit: number;
}

/**
 * Get all configured RPC endpoints
 */
function getConfiguredEndpoints(): RpcEndpointConfig[] {
  const endpoints: RpcEndpointConfig[] = [];
  
  // Ankr endpoints
  if (process.env.ANKR_API_KEY) {
    endpoints.push({
      name: "Ankr Premium",
      url: `https://rpc.ankr.com/etherlink_mainnet/${process.env.ANKR_API_KEY}`,
      expectedBlockLimit: 100,
    });
  } else if (process.env.PONDER_RPC_URL_42793?.includes("ankr.com")) {
    endpoints.push({
      name: "Ankr Public",
      url: process.env.PONDER_RPC_URL_42793,
      expectedBlockLimit: 100,
    });
  }
  
  // Official Etherlink
  endpoints.push({
    name: "Etherlink Official",
    url: "https://node.mainnet.etherlink.com",
    expectedBlockLimit: 100,
  });
  
  // Zeeve
  const zeeveUrl = process.env.ZEEVE_RPC_URL || "https://etherlink-mainnet-pub-l5p9tu.zeeve.net/rpc";
  endpoints.push({
    name: "Zeeve",
    url: zeeveUrl,
    expectedBlockLimit: 100,
  });
  
  // ThirdWeb
  if (process.env.THIRDWEB_API_KEY) {
    endpoints.push({
      name: "ThirdWeb",
      url: `https://42793.rpc.thirdweb.com/${process.env.THIRDWEB_API_KEY}`,
      expectedBlockLimit: 100,
    });
  }
  
  // Generic fallback
  if (process.env.PONDER_RPC_URL_42793 && 
      !process.env.PONDER_RPC_URL_42793.includes("ankr.com")) {
    endpoints.push({
      name: "Custom RPC",
      url: process.env.PONDER_RPC_URL_42793,
      expectedBlockLimit: 100,
    });
  }
  
  return endpoints;
}

/**
 * Test a single endpoint
 */
async function testEndpoint(config: RpcEndpointConfig): Promise<void> {
  console.log(`\n🔍 Testing ${config.name} (${config.url.split('/')[2]})`);
  console.log("=".repeat(60));
  
  const client = createPublicClient({
    chain: etherlink,
    transport: http(config.url),
  });
  
  // Test basic health
  console.log("\n📊 Health Check:");
  const health = await checkRpcHealth(client, config.url, config.expectedBlockLimit);
  console.log(`  Status: ${health.healthy ? "✅ Healthy" : "❌ Unhealthy"}`);
  console.log(`  Latency: ${health.latency}ms`);
  if (health.blockNumber) {
    console.log(`  Current Block: ${health.blockNumber}`);
  }
  console.log(`  Success Rate: ${health.successRate.toFixed(2)}%`);
  
  if (!health.healthy) {
    console.log("  ⚠️  Skipping further tests due to health check failure");
    return;
  }
  
  // Test block range limits
  console.log("\n📏 Testing Block Range Limits:");
  try {
    const { maxSafeRange, testedRanges } = await testBlockRangeLimit(
      client,
      TEST_CONTRACT,
      config.expectedBlockLimit + 50
    );
    
    console.log(`  Max Safe Range: ${maxSafeRange} blocks`);
    console.log("  Tested Ranges:");
    for (const [range, success] of testedRanges.entries()) {
      console.log(`    ${range} blocks: ${success ? "✅" : "❌"}`);
    }
    
    if (maxSafeRange < config.expectedBlockLimit) {
      console.log(`  ⚠️  WARNING: Max safe range (${maxSafeRange}) is less than expected (${config.expectedBlockLimit})`);
    }
  } catch (error) {
    console.error("  ❌ Block range test failed:", error);
  }
  
  // Test rate limiting
  console.log("\n⚡ Testing Rate Limits:");
  const startTime = Date.now();
  const requests = 10;
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < requests; i++) {
    try {
      await client.getBlockNumber();
      successful++;
    } catch (error) {
      failed++;
    }
  }
  
  const duration = Date.now() - startTime;
  const rps = (requests / duration) * 1000;
  
  console.log(`  Requests: ${successful}/${requests} successful`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`  Rate: ${rps.toFixed(2)} req/sec`);
  
  // Get aggregated metrics
  const metrics = getEndpointMetrics(config.url);
  if (metrics) {
    console.log("\n📈 Aggregated Metrics:");
    console.log(`  Total Requests: ${metrics.totalRequests}`);
    console.log(`  Average Latency: ${metrics.averageLatency.toFixed(2)}ms`);
    console.log(`  P95 Latency: ${metrics.p95Latency.toFixed(2)}ms`);
    console.log(`  P99 Latency: ${metrics.p99Latency.toFixed(2)}ms`);
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log("🚀 Etherlink RPC Endpoint Tester");
  console.log("================================");
  console.log(`Testing contract: ${TEST_CONTRACT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  
  const endpoints = getConfiguredEndpoints();
  console.log(`\nFound ${endpoints.length} configured endpoints`);
  
  const healthStatuses: RpcHealthStatus[] = [];
  
  // Test each endpoint
  for (const endpoint of endpoints) {
    try {
      await testEndpoint(endpoint);
      
      // Collect health status
      const client = createPublicClient({
        chain: etherlink,
        transport: http(endpoint.url),
      });
      const health = await checkRpcHealth(client, endpoint.url, endpoint.expectedBlockLimit);
      healthStatuses.push(health);
      
      // Add delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`\n❌ Failed to test ${endpoint.name}:`, error);
    }
  }
  
  // Summary
  console.log("\n\n📊 SUMMARY");
  console.log("==========");
  logHealthStatus(healthStatuses);
  
  // Recommendations
  console.log("\n💡 RECOMMENDATIONS");
  console.log("==================");
  
  const healthyEndpoints = healthStatuses.filter(s => s.healthy);
  const fastEndpoints = healthyEndpoints.filter(s => s.latency < 500);
  
  if (healthyEndpoints.length === 0) {
    console.log("❌ No healthy endpoints found! Check your configuration.");
  } else {
    console.log(`✅ ${healthyEndpoints.length} healthy endpoints available`);
    
    if (fastEndpoints.length > 0) {
      const fastest = fastEndpoints.reduce((a, b) => a.latency < b.latency ? a : b);
      console.log(`🚀 Fastest endpoint: ${fastest.endpoint.split('/')[2]} (${fastest.latency}ms)`);
    }
    
    const premiumEndpoints = healthStatuses.filter(s => 
      s.endpoint.includes("ankr.com") && s.endpoint.includes("/") ||
      s.endpoint.includes("thirdweb.com")
    );
    
    if (premiumEndpoints.length === 0) {
      console.log("\n⚠️  Consider adding premium RPC endpoints for better performance:");
      console.log("   - Ankr Premium: Set ANKR_API_KEY in .env");
      console.log("   - ThirdWeb: Set THIRDWEB_API_KEY in .env");
    }
  }
  
  console.log("\n✨ Testing complete!");
}

// Run the script
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});