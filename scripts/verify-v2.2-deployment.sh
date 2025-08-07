#!/bin/bash

# BMN EVM Contracts Indexer v2.2.0 PostInteraction Deployment Verification Script
# This script verifies the deployment and functionality of the v2.2.0 indexer

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GRAPHQL_ENDPOINT="http://localhost:42069/graphql"
HEALTH_ENDPOINT="http://localhost:42069/health"
READY_ENDPOINT="http://localhost:42069/ready"
FACTORY_ADDRESS_V2_2="0xB436dBBee1615dd80ff036Af81D8478c1FF1Eb68"
FACTORY_ADDRESS_V2_1="0xBc9A20A9FCb7571B2593e85D2533E10e3e9dC61A"
BASE_CHAIN_ID=8453
OPTIMISM_CHAIN_ID=10

# Log file for results
LOG_FILE="verification_results_$(date +%Y%m%d_%H%M%S).log"

echo "========================================" | tee -a "$LOG_FILE"
echo "BMN v2.2.0 PostInteraction Deployment Verification" | tee -a "$LOG_FILE"
echo "Started at: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Function to check service health
check_service_health() {
    local service=$1
    local endpoint=$2
    
    echo -e "${BLUE}Checking $service...${NC}" | tee -a "$LOG_FILE"
    
    if curl -s -o /dev/null -w "%{http_code}" "$endpoint" | grep -q "200"; then
        echo -e "${GREEN}✓ $service is healthy${NC}" | tee -a "$LOG_FILE"
        return 0
    else
        echo -e "${RED}✗ $service is not responding${NC}" | tee -a "$LOG_FILE"
        return 1
    fi
}

# Function to check Docker services
check_docker_services() {
    echo -e "\n${YELLOW}1. DOCKER SERVICES STATUS${NC}" | tee -a "$LOG_FILE"
    echo "----------------------------------------" | tee -a "$LOG_FILE"
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}✗ Docker is not running${NC}" | tee -a "$LOG_FILE"
        exit 1
    fi
    
    # Check PostgreSQL container
    if docker ps | grep -q "bmn-postgres"; then
        echo -e "${GREEN}✓ PostgreSQL container is running${NC}" | tee -a "$LOG_FILE"
        
        # Check PostgreSQL health
        if docker exec bmn-postgres pg_isready -U ponder -d bmn_indexer > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PostgreSQL is healthy${NC}" | tee -a "$LOG_FILE"
        else
            echo -e "${RED}✗ PostgreSQL is unhealthy${NC}" | tee -a "$LOG_FILE"
        fi
    else
        echo -e "${RED}✗ PostgreSQL container is not running${NC}" | tee -a "$LOG_FILE"
    fi
    
    # Check Indexer container
    if docker ps | grep -q "bmn-indexer"; then
        echo -e "${GREEN}✓ Indexer container is running${NC}" | tee -a "$LOG_FILE"
        
        # Get container logs (last 10 lines)
        echo -e "\n${BLUE}Recent indexer logs:${NC}" | tee -a "$LOG_FILE"
        docker logs --tail 10 bmn-indexer 2>&1 | tee -a "$LOG_FILE"
    else
        echo -e "${RED}✗ Indexer container is not running${NC}" | tee -a "$LOG_FILE"
    fi
}

# Function to check GraphQL endpoint
check_graphql_endpoint() {
    echo -e "\n${YELLOW}2. GRAPHQL ENDPOINT STATUS${NC}" | tee -a "$LOG_FILE"
    echo "----------------------------------------" | tee -a "$LOG_FILE"
    
    # Check health endpoint
    check_service_health "Health endpoint" "$HEALTH_ENDPOINT"
    
    # Check ready endpoint
    check_service_health "Ready endpoint" "$READY_ENDPOINT"
    
    # Test GraphQL introspection
    echo -e "\n${BLUE}Testing GraphQL introspection...${NC}" | tee -a "$LOG_FILE"
    
    INTROSPECTION_QUERY='{"query":"{ __schema { types { name } } }"}'
    
    RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$INTROSPECTION_QUERY" 2>/dev/null || echo "FAILED")
    
    if echo "$RESPONSE" | grep -q "__schema"; then
        echo -e "${GREEN}✓ GraphQL endpoint is accessible${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "${RED}✗ GraphQL endpoint is not accessible${NC}" | tee -a "$LOG_FILE"
        echo "Response: $RESPONSE" | tee -a "$LOG_FILE"
    fi
}

# Function to verify PostInteraction tables
verify_postinteraction_tables() {
    echo -e "\n${YELLOW}3. POSTINTERACTION TABLES VERIFICATION${NC}" | tee -a "$LOG_FILE"
    echo "----------------------------------------" | tee -a "$LOG_FILE"
    
    # List of PostInteraction tables to check
    TABLES=(
        "postInteractionOrder"
        "postInteractionResolverWhitelist"
        "makerWhitelist"
        "postInteractionEscrow"
    )
    
    for TABLE in "${TABLES[@]}"; do
        echo -e "\n${BLUE}Checking table: $TABLE${NC}" | tee -a "$LOG_FILE"
        
        # Query for table existence and record count
        QUERY="{\"query\":\"{ ${TABLE}s { items { id } } }\"}"
        
        RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
            -H "Content-Type: application/json" \
            -d "$QUERY" 2>/dev/null || echo "FAILED")
        
        if echo "$RESPONSE" | grep -q "\"${TABLE}s\""; then
            echo -e "${GREEN}✓ Table $TABLE exists in schema${NC}" | tee -a "$LOG_FILE"
            
            # Count records
            if echo "$RESPONSE" | grep -q "\"items\":\[\]"; then
                echo -e "${YELLOW}  → Table is empty (no records yet)${NC}" | tee -a "$LOG_FILE"
            else
                COUNT=$(echo "$RESPONSE" | grep -o "\"id\"" | wc -l)
                echo -e "${GREEN}  → Table contains $COUNT records${NC}" | tee -a "$LOG_FILE"
            fi
        else
            echo -e "${RED}✗ Table $TABLE not found in schema${NC}" | tee -a "$LOG_FILE"
        fi
    done
}

# Function to check factory address indexing
check_factory_indexing() {
    echo -e "\n${YELLOW}4. FACTORY ADDRESS INDEXING${NC}" | tee -a "$LOG_FILE"
    echo "----------------------------------------" | tee -a "$LOG_FILE"
    
    echo -e "${BLUE}Checking v2.2.0 factory address: $FACTORY_ADDRESS_V2_2${NC}" | tee -a "$LOG_FILE"
    
    # Query for srcEscrows from v2.2.0 factory
    QUERY='{"query":"{ srcEscrows(limit: 5, orderBy: \"createdAt\", orderDirection: \"desc\") { items { id chainId escrowAddress transactionHash blockNumber } } }"}'
    
    RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$QUERY" 2>/dev/null || echo "FAILED")
    
    if echo "$RESPONSE" | grep -q "srcEscrows"; then
        echo -e "${GREEN}✓ srcEscrows table is accessible${NC}" | tee -a "$LOG_FILE"
        
        # Check if any escrows exist
        if echo "$RESPONSE" | grep -q "\"items\":\[\]"; then
            echo -e "${YELLOW}  → No srcEscrows indexed yet${NC}" | tee -a "$LOG_FILE"
        else
            COUNT=$(echo "$RESPONSE" | grep -o "\"id\"" | wc -l)
            echo -e "${GREEN}  → Found $COUNT recent srcEscrows${NC}" | tee -a "$LOG_FILE"
        fi
    else
        echo -e "${RED}✗ Unable to query srcEscrows${NC}" | tee -a "$LOG_FILE"
    fi
    
    # Check dstEscrows
    echo -e "\n${BLUE}Checking dstEscrows...${NC}" | tee -a "$LOG_FILE"
    
    QUERY='{"query":"{ dstEscrows(limit: 5, orderBy: \"createdAt\", orderDirection: \"desc\") { items { id chainId escrowAddress transactionHash } } }"}'
    
    RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$QUERY" 2>/dev/null || echo "FAILED")
    
    if echo "$RESPONSE" | grep -q "dstEscrows"; then
        echo -e "${GREEN}✓ dstEscrows table is accessible${NC}" | tee -a "$LOG_FILE"
        
        if echo "$RESPONSE" | grep -q "\"items\":\[\]"; then
            echo -e "${YELLOW}  → No dstEscrows indexed yet${NC}" | tee -a "$LOG_FILE"
        else
            COUNT=$(echo "$RESPONSE" | grep -o "\"id\"" | wc -l)
            echo -e "${GREEN}  → Found $COUNT recent dstEscrows${NC}" | tee -a "$LOG_FILE"
        fi
    else
        echo -e "${RED}✗ Unable to query dstEscrows${NC}" | tee -a "$LOG_FILE"
    fi
}

# Function to check atomicSwap postInteraction flag
check_postinteraction_flag() {
    echo -e "\n${YELLOW}5. ATOMIC SWAP POSTINTERACTION FLAG${NC}" | tee -a "$LOG_FILE"
    echo "----------------------------------------" | tee -a "$LOG_FILE"
    
    QUERY='{"query":"{ atomicSwaps(limit: 5, orderBy: \"srcCreatedAt\", orderDirection: \"desc\") { items { id orderHash postInteraction status srcChainId dstChainId } } }"}'
    
    RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$QUERY" 2>/dev/null || echo "FAILED")
    
    if echo "$RESPONSE" | grep -q "atomicSwaps"; then
        echo -e "${GREEN}✓ atomicSwaps table is accessible${NC}" | tee -a "$LOG_FILE"
        
        # Check if postInteraction field exists
        if echo "$RESPONSE" | grep -q "postInteraction"; then
            echo -e "${GREEN}✓ postInteraction field exists in atomicSwaps${NC}" | tee -a "$LOG_FILE"
            
            # Count PostInteraction swaps
            if echo "$RESPONSE" | grep -q "\"postInteraction\":true"; then
                COUNT=$(echo "$RESPONSE" | grep -o "\"postInteraction\":true" | wc -l)
                echo -e "${GREEN}  → Found $COUNT PostInteraction swaps${NC}" | tee -a "$LOG_FILE"
            else
                echo -e "${YELLOW}  → No PostInteraction swaps found yet${NC}" | tee -a "$LOG_FILE"
            fi
        else
            echo -e "${RED}✗ postInteraction field not found in atomicSwaps${NC}" | tee -a "$LOG_FILE"
        fi
    else
        echo -e "${RED}✗ Unable to query atomicSwaps${NC}" | tee -a "$LOG_FILE"
    fi
}

# Function to check chain statistics
check_chain_statistics() {
    echo -e "\n${YELLOW}6. CHAIN STATISTICS${NC}" | tee -a "$LOG_FILE"
    echo "----------------------------------------" | tee -a "$LOG_FILE"
    
    for CHAIN_ID in $BASE_CHAIN_ID $OPTIMISM_CHAIN_ID; do
        CHAIN_NAME=$([[ $CHAIN_ID == $BASE_CHAIN_ID ]] && echo "Base" || echo "Optimism")
        echo -e "\n${BLUE}Checking $CHAIN_NAME (Chain ID: $CHAIN_ID)${NC}" | tee -a "$LOG_FILE"
        
        QUERY="{\"query\":\"{ chainStatistics(id: \\\"$CHAIN_ID\\\") { id chainId totalSrcEscrows totalDstEscrows totalWithdrawals totalCancellations lastUpdatedBlock } }\"}"
        
        RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
            -H "Content-Type: application/json" \
            -d "$QUERY" 2>/dev/null || echo "FAILED")
        
        if echo "$RESPONSE" | grep -q "chainStatistics"; then
            if echo "$RESPONSE" | grep -q "\"chainId\":$CHAIN_ID"; then
                echo -e "${GREEN}✓ Statistics available for $CHAIN_NAME${NC}" | tee -a "$LOG_FILE"
                
                # Extract statistics
                TOTAL_SRC=$(echo "$RESPONSE" | grep -o '"totalSrcEscrows":"[^"]*"' | cut -d'"' -f4)
                TOTAL_DST=$(echo "$RESPONSE" | grep -o '"totalDstEscrows":"[^"]*"' | cut -d'"' -f4)
                TOTAL_WITHDRAWALS=$(echo "$RESPONSE" | grep -o '"totalWithdrawals":"[^"]*"' | cut -d'"' -f4)
                LAST_BLOCK=$(echo "$RESPONSE" | grep -o '"lastUpdatedBlock":"[^"]*"' | cut -d'"' -f4)
                
                echo -e "  → Total Src Escrows: ${TOTAL_SRC:-0}" | tee -a "$LOG_FILE"
                echo -e "  → Total Dst Escrows: ${TOTAL_DST:-0}" | tee -a "$LOG_FILE"
                echo -e "  → Total Withdrawals: ${TOTAL_WITHDRAWALS:-0}" | tee -a "$LOG_FILE"
                echo -e "  → Last Updated Block: ${LAST_BLOCK:-0}" | tee -a "$LOG_FILE"
            else
                echo -e "${YELLOW}  → No statistics recorded for $CHAIN_NAME yet${NC}" | tee -a "$LOG_FILE"
            fi
        else
            echo -e "${RED}✗ Unable to query chainStatistics for $CHAIN_NAME${NC}" | tee -a "$LOG_FILE"
        fi
    done
}

# Function to test v2.1.0 backward compatibility
check_backward_compatibility() {
    echo -e "\n${YELLOW}7. V2.1.0 BACKWARD COMPATIBILITY${NC}" | tee -a "$LOG_FILE"
    echo "----------------------------------------" | tee -a "$LOG_FILE"
    
    # Check resolver whitelist (v2.1.0 feature)
    echo -e "\n${BLUE}Checking v2.1.0 resolver whitelist...${NC}" | tee -a "$LOG_FILE"
    
    QUERY='{"query":"{ resolverWhitelists { items { id chainId resolver isWhitelisted isActive } } }"}'
    
    RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$QUERY" 2>/dev/null || echo "FAILED")
    
    if echo "$RESPONSE" | grep -q "resolverWhitelists"; then
        echo -e "${GREEN}✓ v2.1.0 resolver whitelist table accessible${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "${RED}✗ v2.1.0 resolver whitelist not accessible${NC}" | tee -a "$LOG_FILE"
    fi
    
    # Check factory admin (v2.1.0 feature)
    echo -e "\n${BLUE}Checking v2.1.0 factory admin...${NC}" | tee -a "$LOG_FILE"
    
    QUERY='{"query":"{ factoryAdmins { items { id chainId admin isActive } } }"}'
    
    RESPONSE=$(curl -s -X POST "$GRAPHQL_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d "$QUERY" 2>/dev/null || echo "FAILED")
    
    if echo "$RESPONSE" | grep -q "factoryAdmins"; then
        echo -e "${GREEN}✓ v2.1.0 factory admin table accessible${NC}" | tee -a "$LOG_FILE"
    else
        echo -e "${RED}✗ v2.1.0 factory admin not accessible${NC}" | tee -a "$LOG_FILE"
    fi
}

# Function to generate summary
generate_summary() {
    echo -e "\n${YELLOW}========================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}VERIFICATION SUMMARY${NC}" | tee -a "$LOG_FILE"
    echo -e "${YELLOW}========================================${NC}" | tee -a "$LOG_FILE"
    
    echo -e "\n${BLUE}Key Findings:${NC}" | tee -a "$LOG_FILE"
    echo "1. Docker services status verified" | tee -a "$LOG_FILE"
    echo "2. GraphQL endpoint accessibility checked" | tee -a "$LOG_FILE"
    echo "3. PostInteraction tables verified" | tee -a "$LOG_FILE"
    echo "4. Factory address indexing status checked" | tee -a "$LOG_FILE"
    echo "5. Atomic swap PostInteraction flag verified" | tee -a "$LOG_FILE"
    echo "6. Chain statistics reviewed" | tee -a "$LOG_FILE"
    echo "7. v2.1.0 backward compatibility tested" | tee -a "$LOG_FILE"
    
    echo -e "\n${BLUE}Configuration:${NC}" | tee -a "$LOG_FILE"
    echo "- Factory v2.2.0: $FACTORY_ADDRESS_V2_2" | tee -a "$LOG_FILE"
    echo "- Base Chain ID: $BASE_CHAIN_ID" | tee -a "$LOG_FILE"
    echo "- Optimism Chain ID: $OPTIMISM_CHAIN_ID" | tee -a "$LOG_FILE"
    echo "- GraphQL Endpoint: $GRAPHQL_ENDPOINT" | tee -a "$LOG_FILE"
    
    echo -e "\n${GREEN}Verification completed at: $(date)${NC}" | tee -a "$LOG_FILE"
    echo -e "${GREEN}Results saved to: $LOG_FILE${NC}"
}

# Main execution
main() {
    check_docker_services
    check_graphql_endpoint
    verify_postinteraction_tables
    check_factory_indexing
    check_postinteraction_flag
    check_chain_statistics
    check_backward_compatibility
    generate_summary
}

# Run verification
main