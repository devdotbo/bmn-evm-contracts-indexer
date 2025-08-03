# BMN EVM Contracts Indexer - Makefile
# Comprehensive build automation for the Bridge Me Not indexer

.PHONY: help
help: ## Show this help message
	@echo "BMN EVM Contracts Indexer - Available Commands"
	@echo "=============================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development Commands
.PHONY: dev
dev: ## Start dev environment with database and hot reloading
	@echo "Starting development environment..."
	@$(MAKE) db-up
	@sleep 3
	@pnpm run dev

.PHONY: clean
clean: ## Clean build artifacts and .ponder directory
	@echo "Cleaning build artifacts..."
	@rm -rf .ponder
	@rm -rf dist
	@rm -rf node_modules/.cache
	@echo "Clean complete!"

# Production Commands
.PHONY: docker-up
docker-up: ## Start all services with Docker Compose
	@echo "Starting all services with Docker Compose..."
	@docker-compose up -d
	@echo "Services started! GraphQL available at http://localhost:42069/graphql"

.PHONY: docker-down
docker-down: ## Stop all Docker Compose services
	@echo "Stopping Docker Compose services..."
	@docker-compose down

.PHONY: docker-logs
docker-logs: ## View Docker Compose logs
	@docker-compose logs -f

.PHONY: start
start: ## Start production indexer
	@echo "Starting production indexer..."
	@pnpm run start

.PHONY: serve
serve: ## Start GraphQL server separately
	@echo "Starting GraphQL server..."
	@pnpm run serve

# Code Quality Commands
.PHONY: lint
lint: ## Run ESLint
	@echo "Running ESLint..."
	@pnpm run lint

.PHONY: lint-fix
lint-fix: ## Run ESLint with auto-fix
	@echo "Running ESLint with auto-fix..."
	@pnpm run lint -- --fix

.PHONY: typecheck
typecheck: ## Run TypeScript type checking
	@echo "Running TypeScript type checking..."
	@pnpm run typecheck

.PHONY: format
format: ## Format code with Prettier
	@echo "Formatting code with Prettier..."
	@pnpm run format

.PHONY: format-check
format-check: ## Check code formatting without changes
	@echo "Checking code formatting..."
	@pnpm run format -- --check

# Database Operations
.PHONY: db
db: ## Access Ponder database CLI
	@echo "Opening Ponder database CLI..."
	@pnpm run db

.PHONY: codegen
codegen: ## Generate TypeScript types from schema
	@echo "Generating TypeScript types from schema..."
	@pnpm run codegen

.PHONY: db-up
db-up: ## Start PostgreSQL and PgAdmin
	@echo "Starting PostgreSQL and PgAdmin..."
	@docker-compose up -d postgres pgadmin
	@echo "PostgreSQL: localhost:5432"
	@echo "PgAdmin: http://localhost:5050"

.PHONY: db-down
db-down: ## Stop PostgreSQL and PgAdmin
	@echo "Stopping PostgreSQL and PgAdmin..."
	@docker-compose stop postgres pgadmin

.PHONY: psql
psql: ## Connect to PostgreSQL
	@echo "Connecting to PostgreSQL..."
	@docker-compose exec postgres psql -U postgres -d ponder

# PostgreSQL Standalone Commands
.PHONY: postgres-up
postgres-up: ## Start PostgreSQL and PgAdmin using standalone compose file
	@echo "Starting PostgreSQL services..."
	@./scripts/postgres-manager.sh start

.PHONY: postgres-down
postgres-down: ## Stop PostgreSQL and PgAdmin standalone services
	@echo "Stopping PostgreSQL services..."
	@./scripts/postgres-manager.sh stop

.PHONY: postgres-restart
postgres-restart: ## Restart PostgreSQL and PgAdmin standalone services
	@echo "Restarting PostgreSQL services..."
	@./scripts/postgres-manager.sh restart

.PHONY: postgres-status
postgres-status: ## Check PostgreSQL services status
	@./scripts/postgres-manager.sh status

.PHONY: postgres-logs
postgres-logs: ## View PostgreSQL services logs
	@./scripts/postgres-manager.sh logs

.PHONY: postgres-backup
postgres-backup: ## Create PostgreSQL database backup
	@./scripts/postgres-manager.sh backup

.PHONY: postgres-psql
postgres-psql: ## Connect to PostgreSQL console (standalone)
	@./scripts/postgres-manager.sh psql

.PHONY: postgres-clean
postgres-clean: ## Clean all PostgreSQL data and volumes
	@./scripts/postgres-manager.sh clean

# Additional Helpful Commands
.PHONY: install
install: ## Install dependencies with pnpm
	@echo "Installing dependencies..."
	@pnpm install

.PHONY: build
build: ## Build the project
	@echo "Building project..."
	@pnpm run build

.PHONY: test
test: ## Run tests (if available)
	@echo "Running tests..."
	@pnpm run test || echo "No test script defined"

.PHONY: deps-update
deps-update: ## Update dependencies
	@echo "Updating dependencies..."
	@pnpm update

.PHONY: deps-check
deps-check: ## Check for outdated dependencies
	@echo "Checking for outdated dependencies..."
	@pnpm outdated

.PHONY: env-setup
env-setup: ## Copy .env.example to .env if not exists
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "Please update .env with your configuration"; \
	else \
		echo ".env already exists"; \
	fi

.PHONY: logs
logs: ## View indexer logs (tail)
	@tail -f .ponder/logs/*.log 2>/dev/null || echo "No logs found. Start the indexer first."

.PHONY: status
status: ## Check service status
	@echo "Checking service status..."
	@echo "\nDocker services:"
	@docker-compose ps
	@echo "\nNode processes:"
	@ps aux | grep -E "ponder|node" | grep -v grep || echo "No indexer processes running"

.PHONY: reset
reset: ## Reset database and clean artifacts
	@echo "Resetting database and cleaning artifacts..."
	@$(MAKE) db-down
	@$(MAKE) clean
	@$(MAKE) db-up
	@echo "Reset complete!"

.PHONY: setup
setup: ## Initial project setup
	@echo "Setting up project..."
	@$(MAKE) env-setup
	@$(MAKE) install
	@$(MAKE) codegen
	@echo "Setup complete! Run 'make dev' to start development"

# Utility targets
.PHONY: check-deps
check-deps:
	@command -v pnpm >/dev/null 2>&1 || { echo "pnpm is required but not installed. Install with: npm install -g pnpm"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }
	@command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required but not installed."; exit 1; }

# Default target
.DEFAULT_GOAL := help