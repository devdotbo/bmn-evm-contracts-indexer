#!/bin/bash

# Verify CrossChainEscrowFactory v2.2.0 ABI
echo "========================================="
echo "CrossChainEscrowFactory v2.2.0 ABI Verification"
echo "========================================="
echo ""

ABI_FILE="abis/CrossChainEscrowFactoryV2_2.json"

if [ ! -f "$ABI_FILE" ]; then
    echo "❌ Error: ABI file not found at $ABI_FILE"
    exit 1
fi

echo "✅ ABI file found: $ABI_FILE"
echo ""

# Check file size
FILE_SIZE=$(wc -c < "$ABI_FILE")
echo "📊 File size: $FILE_SIZE bytes"
echo ""

# Verify critical events
echo "🔍 Checking for critical events..."
echo ""

# Check for PostInteractionEscrowCreated
if cat "$ABI_FILE" | jq -e '.[] | select(.type=="event" and .name=="PostInteractionEscrowCreated")' > /dev/null 2>&1; then
    echo "✅ PostInteractionEscrowCreated event found"
else
    echo "❌ PostInteractionEscrowCreated event NOT found"
fi

# Check for SrcEscrowCreated
if cat "$ABI_FILE" | jq -e '.[] | select(.type=="event" and .name=="SrcEscrowCreated")' > /dev/null 2>&1; then
    echo "✅ SrcEscrowCreated event found"
else
    echo "❌ SrcEscrowCreated event NOT found"
fi

# Check for DstEscrowCreated
if cat "$ABI_FILE" | jq -e '.[] | select(.type=="event" and .name=="DstEscrowCreated")' > /dev/null 2>&1; then
    echo "✅ DstEscrowCreated event found"
else
    echo "❌ DstEscrowCreated event NOT found"
fi

# Check for resolver events
if cat "$ABI_FILE" | jq -e '.[] | select(.type=="event" and .name=="ResolverWhitelisted")' > /dev/null 2>&1; then
    echo "✅ ResolverWhitelisted event found"
else
    echo "❌ ResolverWhitelisted event NOT found"
fi

echo ""
echo "🔍 Checking for critical methods..."
echo ""

# Check for postInteraction method
if cat "$ABI_FILE" | jq -e '.[] | select(.type=="function" and .name=="postInteraction")' > /dev/null 2>&1; then
    echo "✅ postInteraction() method found (IPostInteraction interface)"
else
    echo "❌ postInteraction() method NOT found"
fi

# Check for createSrcEscrow
if cat "$ABI_FILE" | jq -e '.[] | select(.type=="function" and .name=="createSrcEscrow")' > /dev/null 2>&1; then
    echo "✅ createSrcEscrow() method found"
else
    echo "❌ createSrcEscrow() method NOT found"
fi

# Check for createDstEscrow
if cat "$ABI_FILE" | jq -e '.[] | select(.type=="function" and .name=="createDstEscrow")' > /dev/null 2>&1; then
    echo "✅ createDstEscrow() method found"
else
    echo "❌ createDstEscrow() method NOT found"
fi

echo ""
echo "📋 Summary:"
echo "==========="
echo "Contract: SimplifiedEscrowFactory v2.2.0"
echo "Address: 0xB436dBBee1615dd80ff036Af81D8478c1FF1Eb68"
echo "Networks: Base (8453) and Optimism (10)"
echo "Features: PostInteraction support for 1inch integration"
echo ""

# Use abi2human if available
if command -v abi2human &> /dev/null; then
    echo "📖 Human-readable ABI (via abi2human):"
    echo "======================================"
    abi2human "$ABI_FILE"
else
    echo "ℹ️  Install abi2human for human-readable ABI output"
    echo "   npm install -g abi2human"
fi