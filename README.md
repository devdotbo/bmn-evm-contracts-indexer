# BMN EVM Contracts Indexer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.14-brightgreen)](https://nodejs.org)
[![Framework](https://img.shields.io/badge/framework-Ponder%20v0.12.0-blue)](https://ponder.sh)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com)

A high-performance indexer for the Bridge Me Not (BMN) atomic swap protocol, tracking cross-chain escrow operations across Base and Etherlink networks using the Ponder framework.

## 🚀 Features

- **Real-time Indexing**: WebSocket connections with HTTP fallback for instant event processing
- **Multi-chain Support**: Simultaneous indexing of Base (8453) and Etherlink (42793) networks
- **GraphQL API**: Query indexed data through a powerful GraphQL interface
- **Event Tracking**: Comprehensive tracking of escrow creation, withdrawals, cancellations, and fund rescues
- **Cross-chain Correlation**: Automatic linking of source and destination escrows via hashlock
- **Analytics**: Built-in chain statistics and protocol metrics
- **Docker Ready**: Complete containerization with Docker Compose
- **PostgreSQL Backend**: Robust data storage with automatic migrations

## 📋 Prerequisites

- **Node.js**: >= 18.14
- **pnpm**: >= 8.0 (recommended) or npm
- **Docker & Docker Compose**: For containerized deployment
- **PostgreSQL**: 14+ (if running locally without Docker)
- **RPC Endpoints**: Access to Base and Etherlink RPC nodes

## 🏃 Quick Start

### Option 1: Docker Deployment (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/bmn-evm-contracts-indexer.git
   cd bmn-evm-contracts-indexer
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your RPC endpoints and configuration
   ```

3. **Start with Docker Compose**
   ```bash
   make docker-up
   # or
   docker-compose up -d
   ```

4. **Access services**
   - GraphQL API: http://localhost:42069/graphql
   - PgAdmin: http://localhost:5433
   - Health Check: http://localhost:42069/health

### Option 2: Local Development

1. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Configure your RPC endpoints and database credentials
   ```

3. **Start development environment**
   ```bash
   # Start database and all services
   make dev

   # Or start indexer only (requires existing database)
   pnpm dev
   ```

## 🏗️ Architecture

### System Overview

```
┌─────────────────┐     ┌─────────────────┐
│   Base Chain    │     │ Etherlink Chain │
│   (8453)        │     │    (42793)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │  WebSocket/HTTP       │
         └───────────┬───────────┘
                     │
            ┌────────┴────────┐
            │  Ponder Engine  │
            │                 │
            │ • Event Processor│
            │ • State Manager  │
            │ • API Server    │
            └────────┬────────┘
                     │
            ┌────────┴────────┐
            │   PostgreSQL    │
            │                 │
            │ • Escrow Data   │
            │ • Swap States   │
            │ • Statistics    │
            └─────────────────┘
```

### Core Components

1. **ponder.config.ts**: Multi-chain network configuration
2. **ponder.schema.ts**: Database schema definitions
3. **src/index.ts**: Event indexing logic and handlers
4. **abis/**: Contract ABI definitions

### Data Flow

1. **Event Detection**: WebSocket listeners detect contract events in real-time
2. **Event Processing**: Ponder processes events through defined handlers
3. **State Updates**: Database tables are updated with parsed event data
4. **API Serving**: GraphQL endpoint serves indexed data to clients

## 📡 API Documentation

### GraphQL Endpoint

Base URL: `http://localhost:42069/graphql`

### Example Queries

#### Get Active Escrows
```graphql
query GetActiveEscrows {
  srcEscrows(where: { status: "active" }) {
    id
    sender
    srcAsset
    dstAsset
    dstAmount
    hashlock
    timestamp
  }
}
```

#### Get Cross-chain Swap Status
```graphql
query GetSwapStatus($hashlock: String!) {
  atomicSwap(id: $hashlock) {
    id
    srcChainId
    dstChainId
    srcEscrowAddress
    dstEscrowAddress
    status
    createdAt
    completedAt
  }
}
```

#### Get Chain Statistics
```graphql
query GetChainStats {
  chainStatistics {
    id
    chainId
    totalEscrowsCreated
    totalWithdrawals
    totalCancellations
    totalVolumeUSD
    lastUpdated
  }
}
```

### Health Check Endpoints

- **Health**: `GET http://localhost:42069/health`
- **Ready**: `GET http://localhost:42069/ready`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PONDER_RPC_URL_8453` | Base network RPC endpoint | Yes | - |
| `PONDER_RPC_URL_42793` | Etherlink network RPC endpoint | Yes | - |
| `PONDER_WS_URL_8453` | Base WebSocket endpoint | No | - |
| `PONDER_WS_URL_42793` | Etherlink WebSocket endpoint | No | - |
| `BASE_START_BLOCK` | Base indexing start block | No | 0 |
| `ETHERLINK_START_BLOCK` | Etherlink indexing start block | No | 0 |
| `POSTGRES_USER` | PostgreSQL username | Yes | ponder |
| `POSTGRES_PASSWORD` | PostgreSQL password | Yes | - |
| `POSTGRES_DB` | PostgreSQL database name | Yes | bmn_indexer |
| `NODE_ENV` | Environment (development/production) | No | production |

### Contract Addresses

| Contract | Address | Networks |
|----------|---------|----------|
| CrossChainEscrowFactory | `0x75ee15F6BfDd06Aee499ed95e8D92a114659f4d1` | Base, Etherlink |

## 🛠️ Development

### Local Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Start development services**
   ```bash
   make dev
   ```

3. **Run type checking**
   ```bash
   pnpm typecheck
   ```

4. **Lint code**
   ```bash
   pnpm lint
   ```

5. **Format code**
   ```bash
   pnpm format
   ```

### Adding New Chains

1. Update `ponder.config.ts`:
   ```typescript
   networks: {
     newChain: {
       chainId: YOUR_CHAIN_ID,
       transport: http(process.env.PONDER_RPC_URL_YOUR_CHAIN),
     },
   }
   ```

2. Add contract configuration for the new chain
3. Update environment variables
4. Run `pnpm codegen` to generate types

### Schema Modifications

1. Edit `ponder.schema.ts`
2. Run `pnpm codegen` to regenerate types
3. Update event handlers in `src/index.ts`

### Testing

```bash
# Run unit tests (when implemented)
pnpm test

# Test GraphQL queries
pnpm dev
# Navigate to http://localhost:42069/graphql
```

## 🚀 Deployment

### Production with Docker

1. **Build and start services**
   ```bash
   docker-compose -f docker-compose.yml up -d --build
   ```

2. **Monitor logs**
   ```bash
   docker-compose logs -f indexer
   ```

3. **Scale horizontally**
   ```bash
   docker-compose up -d --scale indexer=3
   ```

### Manual Deployment

1. **Build the application**
   ```bash
   pnpm build
   ```

2. **Set production environment**
   ```bash
   export NODE_ENV=production
   ```

3. **Start the indexer**
   ```bash
   pnpm start
   ```

### Monitoring

- **Logs**: Check `docker-compose logs` or application stdout
- **Metrics**: Monitor PostgreSQL query performance
- **Health**: Regular health check endpoint monitoring
- **Alerts**: Set up alerts for missed blocks or connection failures

## 🔧 Troubleshooting

### Common Issues

#### Connection Errors
```
Error: Failed to connect to RPC endpoint
```
**Solution**: Verify RPC URLs in `.env` and check network connectivity

#### Database Connection Failed
```
Error: ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Ensure PostgreSQL is running: `make db-up`

#### Out of Memory
```
JavaScript heap out of memory
```
**Solution**: Increase Node.js memory limit:
```bash
export NODE_OPTIONS="--max-old-space-size=8192"
```

#### Indexing Lag
**Symptoms**: GraphQL returns outdated data
**Solution**: 
- Check RPC rate limits
- Verify WebSocket connections
- Review `ponder.log` for errors

### Debug Mode

Enable verbose logging:
```bash
export PONDER_LOG_LEVEL=debug
pnpm dev
```

### Logs Location

- **Docker**: `docker-compose logs indexer`
- **Local**: Console output or `ponder.log`
- **PostgreSQL**: `docker-compose logs postgres`

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
   - Follow existing code style
   - Add tests for new features
   - Update documentation
4. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add new indexing feature"
   ```
5. **Push and create a Pull Request**

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Run `pnpm format` before committing
- Add JSDoc comments for public APIs

### Reporting Issues

Please use GitHub Issues to report bugs or request features. Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ponder](https://ponder.sh) - The indexing framework
- [Viem](https://viem.sh) - Ethereum interface
- Bridge Me Not Protocol contributors

## 📞 Support

- **Documentation**: [https://docs.bridgemenot.xyz](https://docs.bridgemenot.xyz)
- **Discord**: [Join our community](https://discord.gg/bridgemenot)
- **GitHub Issues**: [Report bugs](https://github.com/your-org/bmn-evm-contracts-indexer/issues)

---

Built with ❤️ by the Bridge Me Not team