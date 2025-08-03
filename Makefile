.PHONY: help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: setup
setup: ## Initial setup: copy env file and install dependencies
	@cp -n .env.example .env || true
	@echo "✅ Environment file created. Please update .env with your RPC URLs"
	@pnpm install

.PHONY: db-up
db-up: ## Start PostgreSQL and PgAdmin containers
	@docker-compose up -d postgres pgadmin
	@echo "⏳ Waiting for PostgreSQL to be ready..."
	@sleep 5
	@docker-compose exec postgres pg_isready -U ponder -d bmn_indexer || true
	@echo "✅ PostgreSQL is ready!"
	@echo "📊 PgAdmin available at: http://localhost:5433"

.PHONY: db-down
db-down: ## Stop database containers
	@docker-compose down

.PHONY: db-reset
db-reset: ## Reset database (WARNING: destroys all data)
	@echo "⚠️  WARNING: This will destroy all database data!"
	@echo "Press Ctrl+C to cancel or Enter to continue..."
	@read confirm
	@docker-compose down -v
	@echo "✅ Database reset complete"

.PHONY: db-logs
db-logs: ## Show database logs
	@docker-compose logs -f postgres

.PHONY: dev
dev: db-up ## Start development environment (database + indexer)
	@echo "🚀 Starting indexer in development mode..."
	@pnpm dev

.PHONY: build
build: ## Build the project
	@pnpm build

.PHONY: start
start: ## Start production indexer (requires built project)
	@pnpm start

.PHONY: docker-build
docker-build: ## Build Docker image for the indexer
	@docker-compose build indexer

.PHONY: docker-up
docker-up: ## Run all services with Docker Compose
	@docker-compose up -d
	@echo "✅ All services started!"
	@echo "📊 PgAdmin: http://localhost:5433"
	@echo "🔍 GraphQL: http://localhost:42069/graphql"
	@echo "❤️  Health: http://localhost:42069/health"

.PHONY: docker-down
docker-down: ## Stop all Docker services
	@docker-compose down

.PHONY: docker-logs
docker-logs: ## Show logs for all services
	@docker-compose logs -f

.PHONY: docker-logs-indexer
docker-logs-indexer: ## Show only indexer logs
	@docker-compose logs -f indexer

.PHONY: status
status: ## Check status of all services
	@echo "🔍 Checking service status..."
	@docker-compose ps
	@echo ""
	@echo "🏥 Health check:"
	@curl -s http://localhost:42069/health || echo "❌ Indexer not responding"
	@echo ""
	@echo "📈 Ready check:"
	@curl -s http://localhost:42069/ready || echo "❌ Indexer not ready"

.PHONY: psql
psql: ## Connect to PostgreSQL with psql
	@docker-compose exec postgres psql -U ponder -d bmn_indexer

.PHONY: db-stats
db-stats: ## Show database statistics
	@docker-compose exec postgres psql -U ponder -d bmn_indexer -c "SELECT * FROM indexing_stats;"

.PHONY: clean
clean: ## Clean build artifacts and dependencies
	@rm -rf dist node_modules .ponder
	@echo "✅ Cleaned build artifacts"

.PHONY: test
test: ## Run tests (when available)
	@echo "⚠️  No tests configured yet"

.PHONY: lint
lint: ## Run linter (when available)
	@echo "⚠️  No linter configured yet"