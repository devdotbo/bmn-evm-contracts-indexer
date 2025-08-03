#!/bin/bash

# BMN PostgreSQL Manager Script
# Manages PostgreSQL and PgAdmin services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.postgres.yml"
PROJECT_NAME="bmn-postgres"

# Helper functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if docker-compose is installed
check_requirements() {
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed"
        exit 1
    fi
}

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    # Read paths from environment or use defaults
    POSTGRES_DATA_PATH=${POSTGRES_DATA_PATH:-./data/postgres}
    POSTGRES_LOGS_PATH=${POSTGRES_LOGS_PATH:-./logs/postgres}
    POSTGRES_BACKUP_PATH=${POSTGRES_BACKUP_PATH:-./backup/postgres}
    PGADMIN_DATA_PATH=${PGADMIN_DATA_PATH:-./data/pgadmin}
    
    # Create directories
    mkdir -p "$POSTGRES_DATA_PATH"
    mkdir -p "$POSTGRES_LOGS_PATH"
    mkdir -p "$POSTGRES_BACKUP_PATH"
    mkdir -p "$PGADMIN_DATA_PATH"
    
    # Set proper permissions for pgadmin
    chmod 777 "$PGADMIN_DATA_PATH"
    
    print_success "Directories created successfully"
}

# Load environment variables
load_env() {
    if [ -f .env.postgres ]; then
        print_info "Loading environment from .env.postgres"
        export $(grep -v '^#' .env.postgres | xargs)
    elif [ -f .env.postgres.example ]; then
        print_warning "No .env.postgres found, copying from .env.postgres.example"
        cp .env.postgres.example .env.postgres
        print_info "Please edit .env.postgres with your configuration"
        exit 1
    fi
}

# Start services
start() {
    print_info "Starting PostgreSQL and PgAdmin services..."
    create_directories
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    print_success "Services started successfully"
    print_info "PostgreSQL is available at localhost:${POSTGRES_PORT:-5432}"
    print_info "PgAdmin is available at http://localhost:${PGADMIN_PORT:-5433}"
    print_info "PgAdmin login: ${PGADMIN_EMAIL:-admin@bmn.local} / ${PGADMIN_PASSWORD:-admin123}"
}

# Stop services
stop() {
    print_info "Stopping PostgreSQL and PgAdmin services..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    print_success "Services stopped successfully"
}

# Restart services
restart() {
    stop
    sleep 2
    start
}

# Show status
status() {
    print_info "Service status:"
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
}

# Show logs
logs() {
    SERVICE=$1
    if [ -z "$SERVICE" ]; then
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f
    else
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f "$SERVICE"
    fi
}

# Backup database
backup() {
    print_info "Creating database backup..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="bmn_indexer_backup_${TIMESTAMP}.sql"
    
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres pg_dump \
        -U ${POSTGRES_USER:-ponder} \
        -d ${POSTGRES_DB:-bmn_indexer} \
        > "${POSTGRES_BACKUP_PATH:-./backup/postgres}/${BACKUP_FILE}"
    
    print_success "Backup created: ${BACKUP_FILE}"
}

# Restore database
restore() {
    BACKUP_FILE=$1
    if [ -z "$BACKUP_FILE" ]; then
        print_error "Please provide a backup file path"
        exit 1
    fi
    
    print_warning "This will overwrite the current database. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_info "Restore cancelled"
        exit 0
    fi
    
    print_info "Restoring database from ${BACKUP_FILE}..."
    
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres psql \
        -U ${POSTGRES_USER:-ponder} \
        -d ${POSTGRES_DB:-bmn_indexer} \
        < "$BACKUP_FILE"
    
    print_success "Database restored successfully"
}

# Connect to PostgreSQL
psql() {
    print_info "Connecting to PostgreSQL..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec postgres psql \
        -U ${POSTGRES_USER:-ponder} \
        -d ${POSTGRES_DB:-bmn_indexer}
}

# Clean everything
clean() {
    print_warning "This will remove all containers, volumes, and data. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_info "Clean cancelled"
        exit 0
    fi
    
    print_info "Cleaning up PostgreSQL and PgAdmin..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v
    
    # Remove data directories
    rm -rf "${POSTGRES_DATA_PATH:-./data/postgres}"
    rm -rf "${POSTGRES_LOGS_PATH:-./logs/postgres}"
    rm -rf "${PGADMIN_DATA_PATH:-./data/pgadmin}"
    
    print_success "Cleanup completed"
}

# Show help
show_help() {
    echo "BMN PostgreSQL Manager"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  start       - Start PostgreSQL and PgAdmin services"
    echo "  stop        - Stop all services"
    echo "  restart     - Restart all services"
    echo "  status      - Show service status"
    echo "  logs [service] - Show logs (optionally for specific service)"
    echo "  backup      - Create database backup"
    echo "  restore <file> - Restore database from backup file"
    echo "  psql        - Connect to PostgreSQL console"
    echo "  clean       - Remove all containers, volumes, and data"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs postgres"
    echo "  $0 backup"
    echo "  $0 restore backup/postgres/bmn_indexer_backup_20240101_120000.sql"
}

# Main script
check_requirements
load_env

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs "$2"
        ;;
    backup)
        backup
        ;;
    restore)
        restore "$2"
        ;;
    psql)
        psql
        ;;
    clean)
        clean
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac