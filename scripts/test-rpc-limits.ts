#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --env-file=.env

// Test RPC block range limits for Etherlink and Base providers
// Usage:
//   # Use default test ranges
//   deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-rpc-limits.ts --chain base
//   deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-rpc-limits.ts --chain etherlink
//   
//   # Test custom range with step
//   deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-rpc-limits.ts --chain base --range 100-200 --step 10
//   deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-rpc-limits.ts --chain etherlink --range 50-150 --step 5
//   
//   # Custom range with default step of 10
//   deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-rpc-limits.ts --chain base --range 100-200
//   
//   # Or specify a different env file:
//   deno run --allow-net --allow-env --allow-read --env-file=.env.one scripts/test-rpc-limits.ts --chain base --range 100-200

import { parseArgs } from "jsr:@std/cli/parse-args";

const FACTORY_ADDRESS = '0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1';

// Chain configurations
interface ChainConfig {
  name: string;
  chainId: number;
  getEndpoints: () => RpcEndpoint[];
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  etherlink: {
    name: 'Etherlink',
    chainId: 42793,
    getEndpoints: () => [
      {
        name: 'ThirdWeb (with API key)',
        url: THIRDWEB_API_KEY ? `https://42793.rpc.thirdweb.com/${THIRDWEB_API_KEY}` : '',
        needsApiKey: true,
      },
      {
        name: 'Ankr Premium',
        url: ANKR_API_KEY 
          ? `https://rpc.ankr.com/etherlink_mainnet/${ANKR_API_KEY}`
          : 'https://rpc.ankr.com/etherlink_mainnet',
      },
      {
        name: 'Official Etherlink',
        url: 'https://node.mainnet.etherlink.com',
      },
      {
        name: 'ThirdWeb (public)',
        url: 'https://42793.rpc.thirdweb.com',
      },
    ],
  },
  base: {
    name: 'Base',
    chainId: 8453,
    getEndpoints: () => [
      {
        name: 'ThirdWeb (with API key)',
        url: THIRDWEB_API_KEY ? `https://8453.rpc.thirdweb.com/${THIRDWEB_API_KEY}` : '',
        needsApiKey: true,
      },
      {
        name: 'Ankr Premium',
        url: ANKR_API_KEY 
          ? `https://rpc.ankr.com/base/${ANKR_API_KEY}`
          : 'https://rpc.ankr.com/base',
      },
      {
        name: 'Official Base',
        url: 'https://mainnet.base.org',
      },
      {
        name: 'ThirdWeb (public)',
        url: 'https://8453.rpc.thirdweb.com',
      },
      {
        name: 'Alchemy (public)',
        url: 'https://base-mainnet.g.alchemy.com/v2/demo',
      },
    ],
  },
};

// Default test configuration
const DEFAULT_TEST_RANGES = [10, 50, 95, 99, 100, 101, 110, 125, 150, 200];

interface RpcEndpoint {
  name: string;
  url: string;
  needsApiKey?: boolean;
}

// Parse command line arguments
const flags = parseArgs(Deno.args, {
  boolean: ["help"],
  string: ["chain", "range", "step"],
  alias: { h: "help" },
});

function showHelp() {
  console.log(`
🧪 RPC Block Range Limit Tester
`);
  console.log(`Usage: deno run [permissions] scripts/test-rpc-limits.ts --chain <chain> [options]
`);
  console.log(`Options:`);
  console.log(`  --chain <chain>  Select the blockchain to test (required)`);
  console.log(`                   Available chains: ${Object.keys(CHAIN_CONFIGS).join(', ')}`);
  console.log(`  --range <start-end>  Test range, e.g., "100-200" (default: predefined values)`);
  console.log(`  --step <number>  Step between each test (default: 10, only used with --range)`);
  console.log(`  -h, --help       Show this help message
`);
  console.log(`Examples:`);
  console.log(`  # Use default test ranges`);
  console.log(`  deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-rpc-limits.ts --chain base`);
  console.log(`  
  # Test custom range from 100 to 200 blocks with step of 10`);
  console.log(`  deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-rpc-limits.ts --chain base --range 100-200 --step 10`);
  console.log(`  
  # Test custom range with default step of 10`);
  console.log(`  deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-rpc-limits.ts --chain etherlink --range 50-150`);
  console.log(`
Default test ranges: ${DEFAULT_TEST_RANGES.join(', ')}`);
  console.log(`
Environment Variables:`);
  console.log(`  THIRDWEB_API_KEY  ThirdWeb API key for premium endpoints`);
  console.log(`  ANKR_API_KEY      Ankr API key for premium endpoints`);
}

// Show help if requested or if no chain specified
if (flags.help || !flags.chain) {
  showHelp();
  Deno.exit(0);
}

const selectedChain = flags.chain.toLowerCase();
if (!CHAIN_CONFIGS[selectedChain]) {
  console.error(`
❌ Invalid chain: ${selectedChain}`);
  console.error(`   Available chains: ${Object.keys(CHAIN_CONFIGS).join(', ')}`);
  console.error(`
Run with --help for usage information.`);
  Deno.exit(1);
}

const chainConfig = CHAIN_CONFIGS[selectedChain];

// Parse range and step parameters
let testRanges = DEFAULT_TEST_RANGES;

if (flags.range) {
  const rangeMatch = flags.range.match(/^(\d+)-(\d+)$/);
  if (!rangeMatch) {
    console.error(`
❌ Invalid range format: ${flags.range}`);
    console.error(`   Expected format: start-end (e.g., "100-200")`);
    console.error(`
Run with --help for usage information.`);
    Deno.exit(1);
  }
  
  const start = parseInt(rangeMatch[1]);
  const end = parseInt(rangeMatch[2]);
  
  if (start >= end) {
    console.error(`
❌ Invalid range: start (${start}) must be less than end (${end})`);
    Deno.exit(1);
  }
  
  const step = flags.step ? parseInt(flags.step) : 10;
  
  if (isNaN(step) || step <= 0) {
    console.error(`
❌ Invalid step: ${flags.step || step}`);
    console.error(`   Step must be a positive number`);
    Deno.exit(1);
  }
  
  // Generate test ranges
  testRanges = [];
  for (let i = start; i <= end; i += step) {
    testRanges.push(i);
  }
  
  // Always include the end value if not already included
  if (testRanges[testRanges.length - 1] !== end) {
    testRanges.push(end);
  }
  
  console.log(`
📊 Using custom range: ${start}-${end} with step ${step}`);
  console.log(`   Test values: ${testRanges.join(', ')}`);
}

// Get API keys from environment
const THIRDWEB_API_KEY = Deno.env.get("THIRDWEB_API_KEY");
const ANKR_API_KEY = Deno.env.get("ANKR_API_KEY");

async function makeRpcCall(url: string, method: string, params: any[]) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: 1,
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

async function testBlockRangeLimit(endpoint: RpcEndpoint) {
  console.log(`\n🔍 Testing: ${endpoint.name}`);
  console.log(`   URL: ${endpoint.url.replace(/\/[a-zA-Z0-9]{32,}$/, '/[API_KEY]')}`);
  
  if (endpoint.needsApiKey && !THIRDWEB_API_KEY) {
    console.log('   ⚠️  Skipped: THIRDWEB_API_KEY not found in .env');
    return;
  }

  try {
    // Get current block number
    const currentBlockHex = await makeRpcCall(endpoint.url, 'eth_blockNumber', []);
    const currentBlock = parseInt(currentBlockHex, 16);
    console.log(`   Current block: ${currentBlock}`);

    let maxWorkingRange = 0;
    
    // Test each range
    for (const range of testRanges) {
      const fromBlock = currentBlock - range;
      const toBlock = currentBlock;
      
      try {
        const startTime = Date.now();
        
        const logs = await makeRpcCall(endpoint.url, 'eth_getLogs', [{
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${toBlock.toString(16)}`,
          address: FACTORY_ADDRESS,
          topics: [
            // SrcEscrowCreated event signature
            "0x0e534c62f0afd2fa0f0fa71198e8aa2d549f24daf2bb47de0d5486c7ce9288ca",
          ],
        }]);
        
        const duration = Date.now() - startTime;
        console.log(`   ✅ ${range} blocks: ${duration}ms (${logs.length} logs)`);
        maxWorkingRange = range;
        
      } catch (error: any) {
        const errorMsg = error.message || error.toString();
        
        if (errorMsg.includes('Cannot request logs over more than') || 
            errorMsg.includes('block range') ||
            errorMsg.includes('100 blocks')) {
          console.log(`   ❌ ${range} blocks: Block range limit exceeded`);
          break;
        } else if (errorMsg.includes('rate limit')) {
          console.log(`   ⚠️  ${range} blocks: Rate limited`);
          // Wait a bit before continuing
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log(`   ❌ ${range} blocks: ${errorMsg.substring(0, 100)}...`);
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`   📊 Maximum working range: ${maxWorkingRange} blocks`);
    
  } catch (error: any) {
    console.log(`   ❌ Connection failed: ${error.message}`);
  }
}

async function main() {
  console.log(`🧪 ${chainConfig.name} RPC Block Range Limit Tester`);
  console.log('==========================================');
  console.log(`Testing contract: ${FACTORY_ADDRESS}`);
  console.log(`Chain: ${chainConfig.name}`);
  console.log(`Chain ID: ${chainConfig.chainId}`);
  
  // Check for API keys
  if (THIRDWEB_API_KEY) {
    console.log('✅ THIRDWEB_API_KEY found');
  } else {
    console.log('⚠️  THIRDWEB_API_KEY not found - some tests will be skipped');
  }
  
  if (ANKR_API_KEY) {
    console.log('✅ ANKR_API_KEY found');
  }
  
  // Get endpoints for selected chain
  const endpoints = chainConfig.getEndpoints();
  
  // Test endpoints sequentially to avoid rate limits
  for (const endpoint of endpoints) {
    if (endpoint.needsApiKey && !endpoint.url) {
      continue; // Skip if API key required but not available
    }
    await testBlockRangeLimit(endpoint);
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Testing complete!');
  
  // Additional info
  console.log('\n📝 Summary:');
  console.log('- Testing shows the actual block range limits for each provider');
  console.log(`- ${chainConfig.name} enforces these limits at the node level`);
  console.log('- Premium API keys provide higher rate limits but not necessarily higher block ranges');
}

// Run the test
main().catch(console.error);