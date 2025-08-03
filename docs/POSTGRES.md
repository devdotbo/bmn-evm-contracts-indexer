# PostgreSQL and PgAdmin Setup

This document describes the standalone PostgreSQL and PgAdmin setup for the BMN EVM Contracts Indexer.

## Overview

The `docker-compose.postgres.yml` file provides a production-ready PostgreSQL database setup with:
- PostgreSQL 16 Alpine with performance optimizations
- PgAdmin 4 for database management
- Health checks and resource limits
- Volume persistence for data, logs, and backups
- Network isolation
- Security hardening

## Quick Start

### 1. Configure Environment

Copy the example configuration:
```bash
cp .env.postgres.example .env.postgres
```

Edit `.env.postgres` with your desired settings.

### 2. Start Services

Using the Makefile:
```bash
make postgres-up
```

Or using Docker Compose directly:
```bash
docker-compose -f docker-compose.postgres.yml up -d
```

Or using the management script:
```bash
./scripts/postgres-manager.sh start
```

### 3. Access Services

- **PostgreSQL**: `localhost:5432`
  - Default credentials: `ponder` / `ponder123`
  - Database: `bmn_indexer`

- **PgAdmin**: `http://localhost:5433`
  - Default login: `admin@bmn.local` / `admin123`
  - PostgreSQL server is pre-configured

## Management Commands

### Using Makefile

```bash
make postgres-up        # Start services
make postgres-down      # Stop services
make postgres-restart   # Restart services
make postgres-status    # Check status
make postgres-logs      # View logs
make postgres-backup    # Create backup
make postgres-psql      # Connect to PostgreSQL
make postgres-clean     # Remove all data
```

### Using Management Script

```bash
./scripts/postgres-manager.sh start              # Start services
./scripts/postgres-manager.sh stop               # Stop services
./scripts/postgres-manager.sh restart            # Restart services
./scripts/postgres-manager.sh status             # Check status
./scripts/postgres-manager.sh logs [service]     # View logs
./scripts/postgres-manager.sh backup             # Create backup
./scripts/postgres-manager.sh restore <file>     # Restore backup
./scripts/postgres-manager.sh psql               # Connect to PostgreSQL
./scripts/postgres-manager.sh clean              # Remove all data
```

## Configuration

### PostgreSQL Performance Tuning

The configuration includes performance optimizations for a 4GB RAM server:

```env
POSTGRES_SHARED_BUFFERS=256MB        # 25% of RAM
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB    # 75% of RAM
POSTGRES_WORK_MEM=4MB               # RAM per operation
POSTGRES_MAX_CONNECTIONS=200         # Maximum connections
```

Adjust these values based on your server specifications.

### Resource Limits

Configure resource limits in `.env.postgres`:

```env
# PostgreSQL
POSTGRES_CPU_LIMIT=2
POSTGRES_MEMORY_LIMIT=2G
POSTGRES_CPU_RESERVATION=0.5
POSTGRES_MEMORY_RESERVATION=512M

# PgAdmin
PGADMIN_CPU_LIMIT=1
PGADMIN_MEMORY_LIMIT=512M
PGADMIN_CPU_RESERVATION=0.25
PGADMIN_MEMORY_RESERVATION=256M
```

### Data Persistence

Data is stored in the following directories:

- `./data/postgres/` - PostgreSQL data
- `./logs/postgres/` - PostgreSQL logs
- `./backup/postgres/` - Database backups
- `./data/pgadmin/` - PgAdmin configuration

## Security Considerations

1. **Change Default Passwords**: Update the default passwords in `.env.postgres`
2. **Network Isolation**: Services run on an isolated Docker network
3. **No New Privileges**: Containers run with `no-new-privileges` security option
4. **Limited Resources**: Resource limits prevent resource exhaustion
5. **Health Checks**: Automatic health monitoring and container restarts

## Backup and Restore

### Create Backup

```bash
make postgres-backup
# or
./scripts/postgres-manager.sh backup
```

Backups are stored in `./backup/postgres/` with timestamp.

### Restore Backup

```bash
./scripts/postgres-manager.sh restore ./backup/postgres/bmn_indexer_backup_20240101_120000.sql
```

## Troubleshooting

### View Logs

```bash
# All services
make postgres-logs

# Specific service
./scripts/postgres-manager.sh logs postgres
./scripts/postgres-manager.sh logs pgadmin
```

### Connection Issues

1. Check if services are running:
   ```bash
   make postgres-status
   ```

2. Verify port availability:
   ```bash
   lsof -i :5432  # PostgreSQL
   lsof -i :5433  # PgAdmin
   ```

3. Test PostgreSQL connection:
   ```bash
   make postgres-psql
   ```

### Permission Issues

If you encounter permission issues with PgAdmin:

```bash
chmod 777 ./data/pgadmin
```

### Reset Everything

To completely reset the PostgreSQL setup:

```bash
make postgres-clean
```

⚠️ **Warning**: This will delete all data, including databases and backups!

## Production Deployment

For production deployment:

1. Use strong passwords in `.env.postgres`
2. Enable SSL/TLS for connections
3. Configure firewall rules
4. Set up regular automated backups
5. Monitor resource usage
6. Consider using a managed PostgreSQL service for critical applications

## Integration with Indexer

The indexer can connect to this PostgreSQL instance using:

```env
DATABASE_URL=postgresql://ponder:ponder123@localhost:5432/bmn_indexer
```

When running the indexer in Docker, use the service name:

```env
DATABASE_URL=postgresql://ponder:ponder123@postgres:5432/bmn_indexer
```