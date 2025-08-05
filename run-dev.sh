#!/bin/bash

# Script to run Ponder indexer

# Load environment variables from .env.local file
if [ -f .env.local ]; then
    echo "Loading environment variables from .env.local..."
    source .env.local
elif [ -f .env ]; then
    echo "Loading environment variables from .env..."
    source .env
else
    echo "Warning: No .env.local or .env file found!"
fi

# Set log level to info (can be overridden by environment)
export PONDER_LOG_LEVEL=${PONDER_LOG_LEVEL:-info}

# Print current configuration
echo "Starting Ponder indexer with:"
echo "  - Log Level: $PONDER_LOG_LEVEL"
echo "  - Base RPC: Using Ankr API"
echo "  - Optimism RPC: Using Ankr API"
echo ""

# Run the indexer
pnpm run dev