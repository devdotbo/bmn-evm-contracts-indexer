#!/bin/bash

# Script to run Ponder indexer with debug logging

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

# Set log level to debug
export PONDER_LOG_LEVEL=debug

# Print current configuration
echo "Starting Ponder indexer with:"
echo "  - Log Level: $PONDER_LOG_LEVEL"
echo "  - Base WebSocket: ${PONDER_WS_URL_8453:-not set}"
echo "  - Etherlink WebSocket: ${PONDER_WS_URL_42793:-not set}"
echo ""

# Run the indexer
pnpm run dev