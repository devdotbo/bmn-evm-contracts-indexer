/**
 * Extended Ponder Configuration Types
 * 
 * This file extends the default Ponder types to include our custom
 * configurations for advanced RPC handling.
 */

import type { Config } from "ponder";

declare module "ponder" {
  interface ChainConfig {
    /**
     * Maximum number of queued requests
     */
    maxQueuedRequests?: number;
    
    /**
     * Request timeout in milliseconds
     */
    requestTimeout?: number;
    
    /**
     * Block range limits for different operations
     */
    blockRanges?: {
      getLogs?: number;
      getBlock?: number;
      multicall?: number;
    };
  }
}