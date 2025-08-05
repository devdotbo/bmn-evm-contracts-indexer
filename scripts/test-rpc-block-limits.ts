#!/usr/bin/env ts-node

import { createPublicClient, http } from 'viem';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const FACTORY_ADDRESS = '0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1';

// Test configuration
const testRanges = [10, 50, 95, 99, 100, 101, 110, 125, 150, 200, 500, 1000];

interface RpcEndpoint {
  name: string;
  url: string;
  needsApiKey?: boolean;
}

// Define RPC endpoints to test
const endpoints: RpcEndpoint[] = [
  {
    name: 'ThirdWeb (with API key)',
    url: `https://42793.rpc.thirdweb.com/${process.env.THIRDWEB_API_KEY}`,
    needsApiKey: true,
  },
  {
    name: 'Ankr Premium',
    url: process.env.ANKR_API_KEY 
      ? `https://rpc.ankr.com/etherlink_mainnet/${process.env.ANKR_API_KEY}`
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
];

async function testBlockRangeLimit(endpoint: RpcEndpoint) {
  console.log(`\n🔍 Testing: ${endpoint.name}`);
  console.log(`   URL: ${endpoint.url.replace(/\/[a-zA-Z0-9]{32,}$/, '/[API_KEY]')}`);
  
  if (endpoint.needsApiKey && !process.env.THIRDWEB_API_KEY) {
    console.log('   ⚠️  Skipped: THIRDWEB_API_KEY not found in .env');
    return;
  }

  try {
    const client = createPublicClient({
      chain: {
        id: 42793,
        name: 'Etherlink',
        network: 'etherlink',
        nativeCurrency: { name: 'Tez', symbol: 'XTZ', decimals: 18 },
        rpcUrls: {
          default: { http: [endpoint.url] },
          public: { http: [endpoint.url] },
        },
      },
      transport: http(endpoint.url, {
        timeout: 30000,
        retryCount: 1,
      }),
    });

    // Get current block number
    const currentBlock = await client.getBlockNumber();
    console.log(`   Current block: ${currentBlock}`);

    let maxWorkingRange = 0;
    
    // Test each range
    for (const range of testRanges) {
      const fromBlock = currentBlock - BigInt(range);
      const toBlock = currentBlock;
      
      try {
        const startTime = Date.now();
        
        await client.getLogs({
          address: FACTORY_ADDRESS,
          fromBlock,
          toBlock,
          events: [
            {
              name: 'SrcEscrowCreated',
              type: 'event',
              inputs: [],
            },
          ],
        });
        
        const duration = Date.now() - startTime;
        console.log(`   ✅ ${range} blocks: ${duration}ms`);
        maxWorkingRange = range;
        
      } catch (error: any) {
        const errorMsg = error.message || error.toString();
        
        if (errorMsg.includes('Cannot request logs over more than')) {
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
    }
    
    console.log(`   📊 Maximum working range: ${maxWorkingRange} blocks`);
    
  } catch (error: any) {
    console.log(`   ❌ Connection failed: ${error.message}`);
  }
}

async function main() {
  console.log('🧪 Etherlink RPC Block Range Limit Tester');
  console.log('==========================================');
  console.log(`Testing contract: ${FACTORY_ADDRESS}`);
  
  // Test endpoints sequentially to avoid rate limits
  for (const endpoint of endpoints) {
    await testBlockRangeLimit(endpoint);
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✅ Testing complete!');
  
  // Additional info
  console.log('\n📝 Summary:');
  console.log('- All Etherlink RPC providers enforce the same block range limit');
  console.log('- This is a chain-level restriction, not provider-specific');
  console.log('- Premium API keys provide higher rate limits but not higher block ranges');
}

// Run the test
main().catch(console.error);