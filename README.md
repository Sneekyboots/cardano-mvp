# Cardano MVP - Yield Safe Impermanent Loss Protection Protocol

A complete decentralized investment protection system that safeguards against impermanent loss by automatically monitoring AMM positions and executing protection strategies when thresholds are breached.

## 🎯 Core Investment Flow

**Pool Creation → User Invests → LP tokens → Monitor IL → Protect**

1. **Create Minswap Pool**: Real ADA/Token pools with liquidity
2. **User Investment**: User-controlled ADA + Token amounts via X×Y=k formula  
3. **LP Token Generation**: Receive liquidity provider tokens
4. **Impermanent Loss Monitoring**: Real-time IL tracking with Charli3 price feeds
5. **Automated Protection**: When IL threshold hit → Withdraw LP → Swap to stablecoin

## 📁 Project Structure

```
cardano-mvp/
├── yield-safe/                    # Main IL Protection Protocol
│   ├── contracts/                 # Aiken Smart Contracts
│   ├── keeper-bot/               # TypeScript Monitoring Service  
│   ├── frontend/                 # React User Interface
│   └── README.md                 # Protocol documentation
│
└── minswap-dex-v2/               # DEX Infrastructure
    ├── validators/               # Pool & Order validators
    ├── src/                     # TypeScript SDK
    └── deployed/                # Network deployments
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ and npm
- **Aiken** v1.0.24-alpha for smart contracts
- **Cardano Wallet** (Nami, Eternl, etc.) for frontend
- **Blockfrost API Key** for blockchain access

### 1. Environment Setup

```bash
# Clone and navigate
git clone <repository-url>
cd cardano-mvp

# Install dependencies for all components
npm run setup
```

### 2. Configure Environment

Create `.env` file in `yield-safe/keeper-bot/`:

```env
# Blockchain Configuration  
CARDANO_NETWORK=Preview
BLOCKFROST_API_KEY=your_blockfrost_api_key_here

# Keeper Bot Settings
KEEPER_PRIVATE_KEY=your_private_key_or_demo_mode
DEFAULT_IL_THRESHOLD=500
MAX_OPERATIONS_PER_HOUR=100
MIN_VAULT_SIZE=1000000

# Database
DATABASE_PATH=./data/keeper.db

# Real Minswap Pools (Auto-populated)
MONITORED_POOLS=[
  {
    "poolId": "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c279c909f348e533da5808898f87f9a14",
    "assetA": {"policyId": "", "tokenName": "ADA"},
    "assetB": {"policyId": "279c909f348e533da5808898f87f9a14", "tokenName": "SNEK"}
  }
]
```

### 3. Start All Services

```bash
# Terminal 1: Start API Server & Keeper Bot
cd yield-safe/keeper-bot
npm run dev

# Terminal 2: Start Frontend (new terminal)
cd yield-safe/frontend  
npm run dev

# Terminal 3: Monitor IL in Real-time (optional)
cd yield-safe/keeper-bot
npm run monitor
```

### 4. Access Application

- **Frontend**: http://localhost:5173
- **API Server**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 💼 Usage Examples

### Create Investment Position

```bash
# Via API
curl -X POST http://localhost:3001/api/invest/complete-flow \
  -H "Content-Type: application/json" \
  -d '{
    "pool_id": "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c...",
    "ada_amount": 100,
    "token_b_amount": 50, 
    "token_b_symbol": "SNEK",
    "estimated_lp_tokens": 70.7,
    "il_threshold": 5,
    "user_address": "addr_test1qq..."
  }'
```

### Monitor Existing Vaults

```bash
# Check vault status
curl http://localhost:3001/api/vaults

# Get IL calculations  
curl http://localhost:3001/api/il-calculator/calculate/VAULT_ID
```

## 🏗️ Development Guide

### Smart Contracts (Aiken)

```bash
cd yield-safe/contracts

# Build contracts
aiken build

# Run tests  
aiken check

# Deploy to testnet
../deploy.sh
```

### Keeper Bot Service

```bash
cd yield-safe/keeper-bot

# Development with auto-reload
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test
```

### Frontend Development

```bash
cd yield-safe/frontend

# Development server
npm run dev

# Production build
npm run build

# Run tests
npm run test
```

### Minswap DEX Integration

```bash
cd minswap-dex-v2

# Build DEX contracts
aiken build

# Generate TypeScript bindings
npm run exec src/build-plutus.ts

# Run DEX tests
npm test
```

## 🔧 Key Components

### 1. Smart Contracts (`yield-safe/contracts/`)
- **vault.ak**: Main vault validator with IL protection logic
- **factory.ak**: Protocol management and vault creation
- **types.ak**: Complete type system for all operations

### 2. Keeper Bot (`yield-safe/keeper-bot/`)
- **apiServer.ts**: REST API for frontend integration
- **realILMonitoring.ts**: Continuous IL monitoring with Charli3
- **realPoolLoader.ts**: Live Minswap pool data integration
- **createMinswapPools.ts**: Real pool creation utilities

### 3. Frontend (`yield-safe/frontend/`)
- **CreateVault.tsx**: User-controlled investment interface
- **RealDashboard.tsx**: Live IL monitoring dashboard
- **WalletProvider.tsx**: Cardano wallet integration

### 4. DEX Infrastructure (`minswap-dex-v2/`)
- **Pool Validators**: Liquidity pool smart contracts
- **Order Validators**: Swap and liquidity order processing
- **Batcher Sample**: Transaction batching examples

## 📊 Real Data Integration

### Price Feeds
- **Charli3**: Real-time ADA/USD and token pricing
- **Minswap**: Live pool reserve and volume data
- **Blockfrost**: Blockchain state and transaction data

### Pool Monitoring
- **3 Active Pools**: ADA/SNEK, ADA/DJED, ADA/MIN
- **Real TVL**: Actual liquidity and trading volumes
- **Live IL Calculation**: Continuous impermanent loss tracking

## 🔍 Testing

### Unit Tests
```bash
# Smart contracts
cd yield-safe/contracts && aiken check

# Keeper bot
cd yield-safe/keeper-bot && npm test  

# Frontend
cd yield-safe/frontend && npm run test
```

### Integration Tests
```bash
# End-to-end investment flow
curl -X POST http://localhost:3001/api/invest/complete-flow -d @test/sample-investment.json

# Wallet connection test
# Connect wallet in frontend at http://localhost:5173
```

### Manual Testing
1. **Connect Wallet**: Use Nami/Eternl with Preview testnet ADA
2. **Create Position**: Set IL threshold (1-50%) and investment amounts
3. **Monitor Dashboard**: Watch real-time IL calculations
4. **Trigger Protection**: IL threshold breach → automatic protection

## 🚀 Deployment

### Testnet Deployment
```bash
# Deploy smart contracts
cd yield-safe && ./deploy.sh

# Configure production environment
export CARDANO_NETWORK=Preview
export BLOCKFROST_API_KEY=preview_xxx

# Start production services
cd keeper-bot && npm run build && npm start
```

### Production Checklist
- [ ] Smart contracts audited and deployed to mainnet
- [ ] Blockfrost production API key configured  
- [ ] Real mainnet pool IDs in MONITORED_POOLS
- [ ] Keeper bot private key secured
- [ ] Frontend deployed with correct API endpoints

## 📋 API Reference

### Investment Flow
- `POST /api/invest/complete-flow` - Create protected investment position
- `GET /api/vaults` - List all user vaults
- `GET /api/vaults/:id` - Get specific vault details

### IL Monitoring
- `GET /api/il-calculator/calculate/:vaultId` - Get current IL percentage
- `GET /api/monitoring/pools` - List monitored pool data
- `GET /api/charli3/price/:symbol` - Get real-time price data

### System Health
- `GET /health` - System health check
- `GET /api/pools/active` - Active Minswap pools
- `GET /api/keeper/status` - Keeper bot operational status

## 🛠️ Troubleshooting

### Common Issues

**Wallet Connection Failed**
```bash
# Check wallet is set to Preview testnet
# Ensure sufficient ADA balance (min 5 ADA)
# Clear browser cache and reconnect
```

**API Server Not Starting**
```bash
# Check environment variables
cd yield-safe/keeper-bot
echo $BLOCKFROST_API_KEY

# Restart with debug logging
DEBUG=* npm run dev
```

**IL Monitoring Not Working**
```bash
# Verify Charli3 API access
curl "https://api.charli3.io/price/ADA"

# Check pool data
curl http://localhost:3001/api/monitoring/pools
```

**Frontend Build Errors**
```bash
cd yield-safe/frontend

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run build
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** Pull Request

### Development Standards
- All smart contracts must pass `aiken check`
- TypeScript code requires type safety (`npm run lint`)
- Frontend components need responsive design
- API endpoints require error handling
- Integration tests for critical flows

## 📄 License

MIT License - see [LICENSE.md](LICENSE.md) for details.

## 🔗 Links

- **Minswap DEX**: https://minswap.org
- **Charli3 Oracle**: https://charli3.io  
- **Aiken Documentation**: https://aiken-lang.org
- **Cardano Developer Portal**: https://developers.cardano.org
- **Lucid Documentation**: https://lucid.spacebudz.io

---

**Built with ❤️ for the Cardano ecosystem**

*Real blockchain transactions • Zero mock data • Complete DeFi protection*