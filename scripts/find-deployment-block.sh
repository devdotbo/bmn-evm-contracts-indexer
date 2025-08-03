#!/bin/bash

# Script to find the deployment block of CrossChainEscrowFactory using cast (Foundry)

CONTRACT_ADDRESS="0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1"

# Load environment variables
if [ -f .env.local ]; then
    source .env.local
elif [ -f .env ]; then
    source .env
fi

echo "Finding deployment block for CrossChainEscrowFactory at $CONTRACT_ADDRESS"
echo ""

# Function to find deployment block using binary search
find_deployment_block() {
    local rpc_url=$1
    local chain_name=$2
    
    echo "Checking $chain_name..."
    
    # Get the latest block
    latest_block=$(cast block-number --rpc-url "$rpc_url")
    echo "  Latest block: $latest_block"
    
    # Binary search for deployment block
    low=0
    high=$latest_block
    deployment_block=""
    
    while [ $low -le $high ]; do
        mid=$(( (low + high) / 2 ))
        
        # Check if contract exists at this block
        code=$(cast code "$CONTRACT_ADDRESS" --block "$mid" --rpc-url "$rpc_url" 2>/dev/null)
        
        if [ -n "$code" ] && [ "$code" != "0x" ]; then
            # Contract exists, try earlier block
            deployment_block=$mid
            high=$((mid - 1))
        else
            # Contract doesn't exist, try later block
            low=$((mid + 1))
        fi
    done
    
    if [ -n "$deployment_block" ]; then
        echo "  Deployment block: $deployment_block"
        
        # Get block timestamp
        timestamp=$(cast block "$deployment_block" --rpc-url "$rpc_url" | grep -E "timestamp" | awk '{print $2}')
        date=$(date -r "$timestamp" 2>/dev/null || date -d "@$timestamp" 2>/dev/null || echo "Unknown")
        echo "  Deployment date: $date"
    else
        echo "  Contract not found!"
    fi
    
    echo ""
}

# Check Base chain
if [ -n "$PONDER_RPC_URL_8453" ]; then
    find_deployment_block "$PONDER_RPC_URL_8453" "Base (8453)"
elif [ -n "$PONDER_WS_URL_8453" ]; then
    # Convert ws to http for cast
    http_url=$(echo "$PONDER_WS_URL_8453" | sed 's/wss:/https:/g' | sed 's/ws:/http:/g')
    find_deployment_block "$http_url" "Base (8453)"
else
    echo "No RPC URL found for Base chain"
fi

# Check Etherlink chain  
if [ -n "$PONDER_RPC_URL_42793" ]; then
    find_deployment_block "$PONDER_RPC_URL_42793" "Etherlink (42793)"
elif [ -n "$PONDER_WS_URL_42793" ]; then
    # Convert ws to http for cast
    http_url=$(echo "$PONDER_WS_URL_42793" | sed 's/wss:/https:/g' | sed 's/ws:/http:/g')
    find_deployment_block "$http_url" "Etherlink (42793)"
else
    echo "No RPC URL found for Etherlink chain"
fi