# Yield Safe - Impermanent Loss Protection Protocol

## 🎯 Project Overview

**Yield Safe** is a DeFi protocol on Cardano that protects liquidity providers from impermanent loss (IL) by automatically monitoring pool positions and enforcing user-defined IL limits through smart contracts.

## 🏗️ Architecture

```
┌──────────────────────────────┐
│   Frontend (React + Lucid)   │
│  • Connect Wallet            │
│  • Set IL Protection Policy  │
│  • Monitor Real-time IL%     │
│  • Deposit/Withdraw Funds    │
└──────────┬───────────────────┘
           │ HTTP/WebSocket
    ┌──────▼─────────────────┐
    │  Yield Safe Vault      │ (Plutus Smart Contract)
    │  Contract              │ • Stores IL policy & funds
    │                        │ • Enforces IL constraints  
    │                        │ • Validates withdrawals
    └──────┬─────────────────┘
           │ On-chain queries
    ┌──────▼─────────────────┐
    │  Keeper Bot Service    │ (TypeScript + Lucid)
    │  Every 60 seconds:     │
    │  1. Query all vaults   │
    │  2. Get Minswap data   │
    │  3. Calculate IL%      │
    │  4. Check IL policy    │
    │  5. Trigger actions    │
    └──────┬─────────────────┘
           │ Pool data queries
    ┌──────▼─────────────────┐
    │  Minswap DEX V2        │ (Reference Data Source)
    │  • Pool reserves       │
    │  • LP token prices     │
    │  • Historical data     │
    └────────────────────────┘
```

## 🔧 Technology Stack

- **Smart Contracts**: Plutus (Aiken)
- **Backend**: TypeScript + Lucid-Cardano
- **Frontend**: React + Vite + Lucid-Cardano
- **Database**: SQLite (keeper bot data)
- **Monitoring**: Custom IL calculation engine
- **Testing**: Cardano testnet (preprod)

## 📁 Project Structure

```
yield-safe/
├── contracts/                 # Phase 1: Smart Contracts
│   ├── src/
│   │   ├── vault.ak           # Main vault contract
│   │   ├── types.ak           # Data types
│   │   └── utils.ak           # Helper functions
│   ├── test/
│   └── aiken.toml
├── keeper-bot/               # Phase 2: Monitoring Service  
│   ├── src/
│   │   ├── keeper.ts          # Main keeper service
│   │   ├── il-calculator.ts   # IL calculation logic
│   │   ├── minswap-client.ts  # Minswap pool data
│   │   ├── vault-monitor.ts   # Vault monitoring
│   │   └── types.ts           # TypeScript types
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # Phase 3: User Interface
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── hooks/            # Custom hooks
│   │   ├── lib/              # Lucid integration
│   │   └── pages/            # Application pages
│   ├── package.json
│   └── vite.config.ts
├── shared/                   # Shared utilities
│   ├── types/                # Common type definitions
│   └── utils/                # Shared functions
└── docs/                    # Documentation
    ├── architecture.md
    ├── api-specs.md
    └── deployment.md
```

## 🚀 Development Phases

### Phase 1: Smart Contracts (Days 1-2)
- Vault contract for storing funds and IL policies
- IL policy enforcement logic
- Deposit/withdrawal mechanisms

### Phase 2: Keeper Bot (Days 2-3)  
- Pool data monitoring from Minswap
- IL calculation engine
- Automated policy enforcement

### Phase 3: Frontend (Days 3-4)
- User dashboard for vault management
- Real-time IL monitoring
- Wallet integration

## 🔐 Security Model

- **On-chain**: Plutus contracts validate all IL policies and fund movements
- **Off-chain**: Keeper bot only monitors and calculates - cannot move funds
- **User Control**: Users maintain full control over their vault policies

## 📊 Key Features

1. **Customizable IL Protection**: Users set their own IL thresholds (5%, 10%, etc.)
2. **Real-time Monitoring**: Continuous tracking of IL across all positions
3. **Automated Enforcement**: Smart contracts prevent withdrawals violating policies
4. **Multi-Pool Support**: Works with any Minswap V2 liquidity pool
5. **Transparent Calculations**: Open-source IL calculation methodology

## 🎯 Success Metrics

- Deploy functional smart contracts on Cardano testnet
- Monitor at least 3 active vault positions
- Calculate IL with <1% accuracy deviation
- Complete end-to-end demo: deposit → monitor → withdraw