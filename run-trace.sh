#!/bin/bash

# Script to run Ponder indexer with trace logging (maximum verbosity)

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

# Set log level to trace for maximum verbosity
export PONDER_LOG_LEVEL=trace

# Print current configuration
echo "Starting Ponder indexer with TRACE logging:"
echo "  - Log Level: $PONDER_LOG_LEVEL"
echo "  - Base WebSocket: ${PONDER_WS_URL_8453:-not set}"
echo "  - Etherlink WebSocket: ${PONDER_WS_URL_42793:-not set}"
echo ""

# Run the indexer
pnpm run dev