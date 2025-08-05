# Multi-RPC Configuration Guide for Etherlink

This document explains the advanced multi-RPC configuration implemented for the Etherlink network in the BMN EVM Contracts Indexer.

## Overview

The Etherlink network has strict limitations on RPC requests, particularly a 100-block limit for `eth_getLogs` calls. To handle this limitation and ensure reliable indexing, we've implemented a sophisticated multi-RPC configuration with:

- **Load balancing** across multiple endpoints
- **Circuit breaker** pattern for failing endpoints
- **Health monitoring** and automatic failover
- **Request deduplication** to reduce redundant calls
- **Exponential backoff** with jitter for retries
- **Priority-based endpoint selection**

## Architecture

### Core Components

1. **RPC Endpoint Configuration**: Each endpoint has specific characteristics:
   - Priority level (lower = higher priority)
   - Rate limits (requests per second/minute)
   - Block limit (100 for Etherlink)
   - Retry configuration
   - Health check settings

2. **Circuit Breaker**: Prevents cascading failures:
   - Opens after 5 consecutive failures
   - Resets after 1 minute
   - Allows "half-open" state for testing recovery

3. **Request Cache**: Deduplicates requests:
   - 5-second TTL
   - Maximum 1000 entries
   - Automatic cleanup every 10 seconds

4. **Health Monitoring**: Tracks endpoint health:
   - Success/failure rates
   - Response latency
   - Circuit breaker state

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Primary Etherlink RPC (fallback)
PONDER_RPC_URL_42793=https://rpc.ankr.com/etherlink_mainnet

# Premium RPC Endpoints (recommended)
ANKR_API_KEY=your_ankr_premium_key      # 1500 req/sec
THIRDWEB_API_KEY=your_thirdweb_key      # Good limits
ZEEVE_RPC_URL=https://custom-zeeve-url  # Optional

# WebSocket (if available)
PONDER_WS_URL_42793=wss://your-ws-endpoint
```

### Endpoint Priority Order

1. **WebSocket** (Priority 1): Best for real-time updates
2. **Ankr Premium** (Priority 2): 1500 req/sec with API key
3. **ThirdWeb** (Priority 2): Premium tier with good limits
4. **Ankr Public** (Priority 3): Limited but reliable
5. **Official Etherlink** (Priority 4): 1000 req/min limit
6. **Zeeve** (Priority 5): Good fallback option
7. **Custom RPC** (Priority 6): User-provided fallback

## Load Balancing Strategy

The system uses viem's `fallback` transport with custom configuration:

```typescript
fallback(transports, {
  rank: {
    interval: 60000,      // Re-rank every minute
    sampleCount: 10,      // Sample size for latency
    timeout: 5000,        // Ranking timeout
    weights: {
      latency: 0.3,       // 30% weight on speed
      stability: 0.7,     // 70% weight on reliability
    },
  },
  retryCount: 3,
  retryDelay: 1000,
});
```

## Rate Limiting

Each endpoint has specific rate limits:

- **Ankr Premium**: 1500 req/sec
- **ThirdWeb**: 100 req/sec (estimated)
- **Official Etherlink**: 16 req/sec (1000/min)
- **Zeeve**: 20 req/sec (conservative)
- **Public endpoints**: 10 req/sec

The configuration automatically adjusts request timing based on these limits.

## Block Range Optimization

Etherlink-specific settings to handle the 100-block limit:

```typescript
etherlink: {
  maxHistoricalBlockRange: 95,  // Under 100-block limit
  syncBatchSize: 50,             // Moderate batch size
  pollInterval: 3000,            // 3 seconds between polls
  
  // Different limits for different operations
  blockRanges: {
    getLogs: 95,      // eth_getLogs limit
    getBlock: 100,    // Single block fetches
    multicall: 50,    // Multicall operations
  },
}
```

## Testing and Monitoring

### Test RPC Endpoints

Run the test script to verify endpoint configuration:

```bash
# Test all configured endpoints
pnpm run test:rpc

# Monitor endpoints continuously
pnpm run monitor:rpc
```

The test script checks:
- Basic connectivity
- Block range limits
- Rate limit handling
- Performance metrics

### Health Monitoring

The system tracks:
- Success/failure rates
- Response latency (average, P95, P99)
- Circuit breaker state
- Requests per second

### Debugging

Enable debug logging:

```bash
PONDER_LOG_LEVEL=debug pnpm run dev
```

Check circuit breaker state in logs:
```
Circuit breaker opened for endpoint: https://...
WebSocket connected to wss://...
```

## Troubleshooting

### Common Issues

1. **"Circuit breaker open" errors**
   - Endpoint has failed too many times
   - Wait 1 minute for automatic reset
   - Check endpoint health with `pnpm run test:rpc`

2. **Slow indexing**
   - Add premium RPC endpoints (Ankr, ThirdWeb)
   - Reduce `maxHistoricalBlockRange` if seeing errors
   - Check rate limit compliance

3. **"Block range too large" errors**
   - Reduce `maxHistoricalBlockRange` below current value
   - Ensure all endpoints respect 100-block limit
   - Check contract-specific `maxBlockRange` settings

4. **WebSocket disconnections**
   - Normal behavior, will auto-reconnect
   - Check `keepAlive` and `reconnect` settings
   - Consider HTTP fallback priority

### Performance Tuning

1. **For faster initial sync**:
   - Use premium endpoints (Ankr, ThirdWeb)
   - Increase `syncBatchSize` (but stay under block limit)
   - Add more RPC endpoints for better distribution

2. **For stability**:
   - Lower `maxHistoricalBlockRange` to 50-75
   - Increase `pollInterval` to reduce request rate
   - Enable more conservative retry settings

3. **For cost optimization**:
   - Prioritize free endpoints
   - Use WebSocket where available
   - Enable request caching

## Best Practices

1. **Always use premium endpoints in production**
   - Better rate limits
   - Higher reliability
   - Faster sync times

2. **Monitor endpoint health regularly**
   - Run `test:rpc` before deployments
   - Check logs for circuit breaker events
   - Track indexing progress

3. **Configure appropriately for your use case**
   - High-frequency updates: Prioritize WebSocket
   - Historical indexing: Prioritize high-rate endpoints
   - Cost-sensitive: Use free endpoints with conservative settings

4. **Handle failures gracefully**
   - Circuit breaker prevents cascade failures
   - Automatic failover maintains uptime
   - Request cache reduces redundant calls

## Future Enhancements

Potential improvements to consider:

1. **Dynamic rate limit adjustment** based on response headers
2. **Endpoint-specific block range limits** based on testing
3. **Prometheus metrics export** for monitoring
4. **Request routing** based on query type
5. **Cost tracking** for premium endpoints