/**
 * RPC Health Monitoring Utilities
 * 
 * This module provides utilities for monitoring the health and performance
 * of RPC endpoints used by the Etherlink indexer.
 */

import type { PublicClient } from "viem";

export interface RpcHealthStatus {
  endpoint: string;
  healthy: boolean;
  latency: number;
  blockNumber?: bigint;
  blockLimit: number;
  lastCheck: Date;
  errorCount: number;
  successRate: number;
  circuitBreakerOpen: boolean;
}

export interface RpcMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  requestsPerSecond: number;
}

// Store metrics for each endpoint
const endpointMetrics = new Map<string, {
  requests: number[];
  latencies: number[];
  failures: number;
  successes: number;
  lastReset: number;
}>();

/**
 * Test RPC endpoint health by performing a simple eth_blockNumber call
 */
export async function checkRpcHealth(
  client: PublicClient,
  endpoint: string,
  blockLimit: number = 100
): Promise<RpcHealthStatus> {
  const startTime = Date.now();
  const metrics = getOrCreateMetrics(endpoint);
  
  try {
    const blockNumber = await client.getBlockNumber();
    const latency = Date.now() - startTime;
    
    // Record successful request
    metrics.successes++;
    metrics.latencies.push(latency);
    metrics.requests.push(Date.now());
    
    return {
      endpoint,
      healthy: true,
      latency,
      blockNumber,
      blockLimit,
      lastCheck: new Date(),
      errorCount: metrics.failures,
      successRate: calculateSuccessRate(metrics),
      circuitBreakerOpen: false,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    
    // Record failed request
    metrics.failures++;
    metrics.requests.push(Date.now());
    
    console.error(`RPC health check failed for ${endpoint}:`, error);
    
    return {
      endpoint,
      healthy: false,
      latency,
      blockLimit,
      lastCheck: new Date(),
      errorCount: metrics.failures,
      successRate: calculateSuccessRate(metrics),
      circuitBreakerOpen: metrics.failures >= 5, // Simple circuit breaker logic
    };
  }
}

/**
 * Test block range limits for eth_getLogs
 */
export async function testBlockRangeLimit(
  client: PublicClient,
  contractAddress: string,
  maxRange: number = 100
): Promise<{ maxSafeRange: number; testedRanges: Map<number, boolean> }> {
  const currentBlock = await client.getBlockNumber();
  const testedRanges = new Map<number, boolean>();
  let maxSafeRange = 0;
  
  // Test different block ranges
  const testRanges = [10, 25, 50, 75, 90, 95, 99, 100, 101, 110, 125, 150];
  
  for (const range of testRanges) {
    if (range > maxRange + 50) break; // Don't test too far beyond expected limit
    
    try {
      const fromBlock = currentBlock - BigInt(range);
      const toBlock = currentBlock;
      
      await client.getLogs({
        address: contractAddress,
        fromBlock,
        toBlock,
      });
      
      testedRanges.set(range, true);
      maxSafeRange = range;
    } catch (error) {
      testedRanges.set(range, false);
      console.log(`Block range ${range} failed:`, error);
      break; // Stop testing higher ranges
    }
  }
  
  return { maxSafeRange, testedRanges };
}

/**
 * Get or create metrics for an endpoint
 */
function getOrCreateMetrics(endpoint: string) {
  let metrics = endpointMetrics.get(endpoint);
  
  if (!metrics) {
    metrics = {
      requests: [],
      latencies: [],
      failures: 0,
      successes: 0,
      lastReset: Date.now(),
    };
    endpointMetrics.set(endpoint, metrics);
  }
  
  // Reset metrics every hour
  if (Date.now() - metrics.lastReset > 3600000) {
    metrics.requests = [];
    metrics.latencies = [];
    metrics.failures = 0;
    metrics.successes = 0;
    metrics.lastReset = Date.now();
  }
  
  return metrics;
}

/**
 * Calculate success rate for an endpoint
 */
function calculateSuccessRate(metrics: ReturnType<typeof getOrCreateMetrics>): number {
  const total = metrics.successes + metrics.failures;
  return total === 0 ? 0 : (metrics.successes / total) * 100;
}

/**
 * Get aggregated metrics for an endpoint
 */
export function getEndpointMetrics(endpoint: string): RpcMetrics | null {
  const metrics = endpointMetrics.get(endpoint);
  if (!metrics) return null;
  
  const now = Date.now();
  const recentRequests = metrics.requests.filter(t => now - t < 60000); // Last minute
  const requestsPerSecond = recentRequests.length / 60;
  
  const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedLatencies.length * 0.95);
  const p99Index = Math.floor(sortedLatencies.length * 0.99);
  
  return {
    totalRequests: metrics.successes + metrics.failures,
    successfulRequests: metrics.successes,
    failedRequests: metrics.failures,
    averageLatency: sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length || 0,
    p95Latency: sortedLatencies[p95Index] || 0,
    p99Latency: sortedLatencies[p99Index] || 0,
    requestsPerSecond,
  };
}

/**
 * Log health status for all endpoints
 */
export function logHealthStatus(statuses: RpcHealthStatus[]) {
  console.log('\n=== RPC Endpoint Health Status ===');
  console.log(new Date().toISOString());
  console.log('==================================\n');
  
  for (const status of statuses) {
    const healthIcon = status.healthy ? '✅' : '❌';
    const cbIcon = status.circuitBreakerOpen ? '🔴' : '🟢';
    
    console.log(`${healthIcon} ${status.endpoint}`);
    console.log(`   Circuit Breaker: ${cbIcon}`);
    console.log(`   Latency: ${status.latency}ms`);
    console.log(`   Success Rate: ${status.successRate.toFixed(2)}%`);
    console.log(`   Error Count: ${status.errorCount}`);
    if (status.blockNumber) {
      console.log(`   Block Number: ${status.blockNumber}`);
    }
    console.log(`   Block Limit: ${status.blockLimit}`);
    console.log(`   Last Check: ${status.lastCheck.toISOString()}`);
    console.log('');
  }
}

/**
 * Export metrics to Prometheus format (optional)
 */
export function exportMetricsPrometheus(): string {
  const lines: string[] = [];
  
  lines.push('# HELP rpc_requests_total Total number of RPC requests');
  lines.push('# TYPE rpc_requests_total counter');
  
  for (const [endpoint, metrics] of endpointMetrics.entries()) {
    const total = metrics.successes + metrics.failures;
    lines.push(`rpc_requests_total{endpoint="${endpoint}",status="success"} ${metrics.successes}`);
    lines.push(`rpc_requests_total{endpoint="${endpoint}",status="failure"} ${metrics.failures}`);
  }
  
  lines.push('\n# HELP rpc_request_duration_seconds RPC request duration in seconds');
  lines.push('# TYPE rpc_request_duration_seconds histogram');
  
  for (const [endpoint, metrics] of endpointMetrics.entries()) {
    const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length || 0;
    lines.push(`rpc_request_duration_seconds{endpoint="${endpoint}",quantile="0.5"} ${avgLatency / 1000}`);
  }
  
  return lines.join('\n');
}