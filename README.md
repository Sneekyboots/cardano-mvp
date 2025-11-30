# Yield Safe - Impermanent Loss Protection Protocol

## 🚀 Quick Summary
- **Yield Safe** protects Cardano liquidity providers from impermanent loss using smart contracts and AI agents.
- **Frontend**: React dashboard for vault management and real-time monitoring.
- **Backend**: Keeper bot automates monitoring and enforcement.
- **Masumi Agents**: AI modules for rebalancing, policy enforcement, and safety automation (Track 2 focus).
- **How to run**: Install dependencies, set up `.env` with API keys, run frontend and backend, or use Docker Compose.

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
    └──────┬─────────────────┘
           │ Oracle price feeds
    ┌──────▼─────────────────┐
    │  Charlie3 Oracle       │ (On-chain Oracle)
    │  • Asset price feeds   │
    │  • Reliable market data│
    └──────┬─────────────────┘
           │ AI jobs & analytics
    ┌──────▼─────────────────┐
    │  Masumi Agents         │ (AI-powered jobs)
    │  • Rebalancing         │
    │  • IL Policy Enforcement│
    │  • Emergency Exit      │
    │  • Decision Verification│
    │  • Reporting           │
    └────────────────────────┘
```

## ⚡️ How to Run (Local Development)

### 1. Prerequisites
- Node.js v18+
- npm
- Cardano testnet wallet (for frontend)
- API keys (see below)

### 2. Environment Variables
Create a file named `.env` in the `yield-safe/` directory (root of the repo):

```env
BLOCKFROST_API_KEY=your_blockfrost_key_here
OPENAI_API_KEY=your_openai_key_here
CHARLIE3_API_KEY=your_charlie3_key_here
NODE_ENV=development
```

- `BLOCKFROST_API_KEY`: For Cardano blockchain queries (keeper-bot)
- `OPENAI_API_KEY`: For AI features and Masumi agents (keeper-bot)
- `CHARLIE3_API_KEY`: For accessing Charlie3 oracle price feeds (keeper-bot)
- `NODE_ENV`: Set to `development` or `production`

### 3. Run the Frontend

```bash
cd yield-safe/frontend
npm install
npm run dev
# Visit http://localhost:5173
```

### 4. Run the Keeper Bot (Backend)

```bash
cd yield-safe/keeper-bot
npm install
npm run dev
```

- The keeper bot will use the API keys from the `.env` file in the root directory.
- By default, it runs on port 3001.

### 5. Docker Compose (Optional)

To run both services together:

```bash
cd yield-safe
docker compose up --build
```

- Frontend: http://localhost:3000
- Keeper Bot API: http://localhost:3001

## 🔧 Technology Stack

- **Smart Contracts**: Plutus (Aiken)
- **Backend**: TypeScript + Lucid-Cardano
- **Frontend**: React + Vite + Lucid-Cardano
- **Database**: SQLite (keeper bot data)
- **Monitoring**: Custom IL calculation engine
- **Oracles**: Charlie3 (on-chain price feeds)
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

## � Success Metrics

- Deploy functional smart contracts on Cardano testnet
- Monitor at least 3 active vault positions
- Calculate IL with <1% accuracy deviation
- Complete end-to-end demo: deposit → monitor → withdraw

## 🔑 API Keys & Configuration

- Place your API keys in `.env` at the root of the `yield-safe` directory.
- Example:
  - `BLOCKFROST_API_KEY=...` (get from blockfrost.io)
  - `OPENAI_API_KEY=...` (get from platform.openai.com)

## 📝 Troubleshooting
- If you see missing API key errors, check your `.env` file location and contents.
- For Docker, ensure `.env` is present before building images.

## 🏁 Walkthrough: Getting Started with Yield Safe

### 1. Clone the Repository

```bash
git clone https://github.com/Sneekyboots/cardano-mvp.git
cd cardano-mvp/yield-safe
```

### 2. Install Prerequisites
- **Node.js v18+**: [Download here](https://nodejs.org/)
- **npm**: Comes with Node.js
- **Docker** (optional, for container deployment)
- **Cardano testnet wallet** (for frontend testing)

### 3. Configure API Keys
Create a `.env` file in the `yield-safe/` directory:

```env
BLOCKFROST_API_KEY=your_blockfrost_key_here
OPENAI_API_KEY=your_openai_key_here
CHARLIE3_API_KEY=your_charlie3_key_here
NODE_ENV=development
```

- Get your Blockfrost key from [blockfrost.io](https://blockfrost.io/)
- Get your OpenAI key from [platform.openai.com](https://platform.openai.com/)
- Get your Charlie3 oracle key from the Charlie3 documentation or website.

### 4. Install Dependencies

#### Frontend
```bash
cd frontend
npm install
```

#### Keeper Bot (Backend)
```bash
cd ../keeper-bot
npm install
```

### 5. Run the Project Locally

#### Start the Backend (Keeper Bot)
```bash
npm run dev
```
- Runs on port 3001 by default
- Monitors vaults, calculates IL, and enforces policies

#### Start the Frontend
```bash
cd ../frontend
npm run dev
```
- Runs on port 5173 by default
- Visit [http://localhost:5173](http://localhost:5173)
- Connect your Cardano testnet wallet
- Set IL protection policies, deposit/withdraw funds, and monitor positions

### 6. Explore the App
- **Dashboard**: View vaults, IL status, and pool data
- **Vault Management**: Create, deposit, withdraw, and set IL policies
- **Real-time Monitoring**: See live updates from the keeper bot
- **Wallet Integration**: Connect with Eternl, Nami, or other supported wallets

### 7. Run with Docker (Optional)

```bash
cd ..
docker compose up --build
```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Keeper Bot API: [http://localhost:3001](http://localhost:3001)

### 8. Smart Contracts (Aiken)
- Contracts are in `contracts/`
- To build/test contracts:
  ```bash
  cd contracts
  aiken build
  aiken test
  ```
- Deploy to Cardano testnet using provided scripts

### 9. Advanced: Customization & Testing
- **Change IL policies**: Edit via frontend dashboard
- **Add pools**: Update keeper bot config or code
- **Test with real Cardano testnet funds**
- **Review logs**: Check backend logs for monitoring and enforcement actions

### 10. Documentation
- See `docs/architecture.md` for system design
- See `docs/api-specs.md` for API details
- See `docs/deployment.md` for deployment options

## � Project Status: Track 2 - Masumi Agent Integration

Yield Safe is currently in **Track 2**, focusing on integrating and operationalizing Masumi agents:

- Implementing AI-powered jobs for rebalancing, IL enforcement, emergency exits, and decision verification
- Connecting Masumi agent analytics to the keeper bot and frontend dashboard
- Testing and refining agent-driven automation and reporting

This phase builds on the smart contract foundation and sets up advanced, AI-driven safety and automation for Cardano DeFi users.

## 🤖 Masumi Agents Integration

**Masumi agents** are AI-powered modules integrated into the Yield Safe protocol to enhance decision-making and risk management. Here’s how they are used:

- **AI Rebalancer**: Masumi agents analyze pool data and impermanent loss trends, then suggest optimal rebalancing actions to minimize risk and maximize yield.
- **Automated Monitoring**: The keeper bot leverages Masumi agents to continuously monitor vaults and pools, triggering alerts or actions when IL thresholds are breached.
- **Decision Verification**: Before executing critical actions (e.g., emergency exits, policy updates), Masumi agents verify the logic and simulate outcomes to ensure user safety.
- **User Dashboard**: The frontend displays Masumi agent recommendations, allowing users to review, accept, or override AI-driven suggestions.

Masumi agents combine on-chain data, off-chain analytics, and AI models to provide smarter, safer DeFi automation for Cardano liquidity providers.

## 🧩 Masumi Agent Jobs

Masumi agents operate through a set of specialized jobs that automate and enhance protocol safety:

- **Rebalancing Job**: Periodically analyzes pool data and vault positions, then recommends or executes rebalancing actions to optimize yield and reduce impermanent loss.
- **IL Policy Enforcement Job**: Monitors all vaults for IL threshold breaches and triggers smart contract enforcement (e.g., restricts withdrawals, sends alerts).
- **Emergency Exit Job**: Detects critical risk scenarios and simulates emergency exit actions, providing recommendations or automated responses to protect user funds.
- **AI Decision Verification Job**: Before any automated action, simulates and verifies the outcome using AI models to ensure safety and compliance with user policies.
- **Reporting Job**: Aggregates vault and pool data, generates analytics, and updates the frontend dashboard with actionable insights.

Each job runs on a schedule (e.g., every 60 seconds) and is coordinated by the keeper bot, with results surfaced to users via the dashboard and notification system.

## 🆘 Need Help?
- Check `.env` file for correct API keys
- Review logs for errors
- See documentation in `docs/`
- Open an issue on GitHub for support

## 📝 Key Takeaways
- Yield Safe is a Cardano DeFi protocol focused on impermanent loss protection.
- Smart contracts enforce user-defined IL policies.
- Keeper bot and Masumi agents automate monitoring and safety actions.
- Project is currently in Track 2: AI agent integration and automation.
- Easy setup: clone, configure `.env`, install, and run.
- See docs for architecture, API, and deployment details.