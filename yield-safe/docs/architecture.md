# Yield Safe Architecture

## 🎯 System Overview

Yield Safe is a 3-layer DeFi protocol protecting liquidity providers from impermanent loss:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Keeper Bot    │    │  Smart Contract │
│   (React)       │────│   (TypeScript)  │────│    (Plutus)     │
│                 │    │                 │    │                 │
│ • User Interface│    │ • IL Monitoring │    │ • Fund Custody  │
│ • Wallet Connect│    │ • Pool Queries  │    │ • Policy Logic  │
│ • IL Dashboard  │    │ • Calculations  │    │ • Validations   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔄 Data Flow Architecture

### 1. User Deposit Flow
```
User → Frontend → Smart Contract → Vault Creation
  ↓
Vault stores: [Assets + IL Policy + Metadata]
  ↓
Keeper Bot detects new vault → Starts monitoring
```

### 2. Monitoring Flow  
```
Keeper Bot (every 60s):
  ↓
Query Minswap Pools → Get current reserves/prices
  ↓
Query User Vaults → Get deposit prices/amounts  
  ↓
Calculate IL% → Compare with user policy
  ↓
Log results → Update dashboard data
```

### 3. Withdrawal Flow
```
User requests withdrawal → Smart Contract validation:
  ↓
Check IL% vs Policy → If within limits: Allow
  ↓                   If exceeds: Reject
Success → Return funds to user
```

## 🧩 Component Interactions

| Component | Sends To | Receives From | Data Type |
|-----------|----------|---------------|-----------|
| Frontend | Smart Contract | User actions | Transactions |
| Frontend | Keeper Bot | Dashboard queries | HTTP requests |
| Keeper Bot | Minswap Pools | Pool state | UTxO queries |
| Keeper Bot | Smart Contract | Vault states | UTxO queries |
| Smart Contract | Blockchain | State changes | Transactions |

## 📊 Data Types

### On-Chain (Plutus)
```haskell
-- User's IL protection policy
data UserPolicy = UserPolicy
  { maxILPercent :: Integer      -- Max IL% (e.g., 500 = 5%)
  , depositPrice :: AssetRatio   -- Original asset ratio  
  , emergencyWithdraw :: Bool    -- Allow emergency exit
  }

-- Vault state containing user funds
data VaultDatum = VaultDatum
  { owner :: PubKeyHash         -- Vault owner
  , policy :: UserPolicy        -- IL protection rules
  , lpAsset :: Asset           -- LP token being protected
  , depositAmount :: Integer    -- Original deposit amount
  , depositTime :: POSIXTime   -- When deposit was made
  }

-- Actions users can take
data VaultAction 
  = Deposit Integer            -- Deposit LP tokens
  | Withdraw Integer           -- Withdraw (if IL policy allows)
  | UpdatePolicy UserPolicy   -- Change IL settings
  | EmergencyExit             -- Force withdrawal (if enabled)
```

### Off-Chain (TypeScript)
```typescript
// Vault monitoring data
interface Vault {
  address: string;
  owner: string;
  lpAsset: Asset;
  policy: UserPolicy;
  depositAmount: bigint;
  depositPrice: AssetRatio;
  currentIL: number;
  lastUpdated: Date;
}

// IL calculation snapshot
interface ILSnapshot {
  vaultAddress: string;
  timestamp: Date;
  originalRatio: number;
  currentRatio: number;
  ilPercent: number;
  withinPolicy: boolean;
}

// Keeper bot decision
interface PolicyDecision {
  vaultAddress: string;
  action: 'ALLOW' | 'BLOCK' | 'ALERT';
  reason: string;
  ilPercent: number;
  policyLimit: number;
}
```

## 🔐 Security Architecture

### On-Chain Security
- **Fund Custody**: Smart contracts hold all user funds
- **Policy Enforcement**: Plutus validates all withdrawals against IL policies  
- **Immutable Logic**: Core protection logic cannot be bypassed

### Off-Chain Trust Model
- **Keeper Bot Role**: Monitor-only, cannot move funds
- **Data Integrity**: IL calculations are verifiable and transparent
- **User Sovereignty**: Users can always emergency withdraw (if enabled)

### Testnet Limitations
- **Development Phase**: Not audited for mainnet use
- **Limited Pools**: Only monitoring select Minswap pools
- **Best Effort**: No SLA guarantees for monitoring uptime

## ⚡ Scalability Design

### MVP (Hackathon)
- Monitor 5-10 vaults maximum
- Single keeper bot instance
- Basic IL calculation (simple price ratios)
- Manual deployment

### Production (Future)
- Monitor 1000+ vaults
- Multi-instance keeper bot with failover
- Advanced IL models (time-weighted, fee-adjusted)
- Automated CI/CD pipeline

### Enterprise (Long-term)
- Cross-DEX IL protection (not just Minswap)
- Advanced strategies (hedging, rebalancing)
- Insurance-backed IL coverage
- DAO governance for protocol parameters

## 🎬 Live Demo Flow (Nov 30)

### Setup (5 min)
```bash
cd yield-safe
npm run demo:setup    # Deploy contracts, start services
npm run demo:seed     # Create test vaults and orders
```

### Demo Walkthrough (15 min)
1. **Connect Wallet** → Show testnet ADA balance
2. **Create Vault** → Deposit LP tokens with 5% IL limit  
3. **Monitor Dashboard** → Real-time IL% tracking
4. **Simulate IL** → Price changes trigger policy checks
5. **Attempt Withdrawal** → Show policy enforcement
6. **Emergency Exit** → Demonstrate user control

### Key Metrics to Highlight
- ⚡ **Response Time**: IL calculations under 30 seconds
- 🎯 **Accuracy**: Within 1% of manual calculations  
- 🛡️ **Protection**: 100% policy enforcement rate
- 🔄 **Uptime**: Keeper bot 99%+ availability during demo

## 📈 Success Criteria

### Technical Milestones
- [ ] Smart contracts deployed and tested on preprod
- [ ] Keeper bot monitoring 3+ active vaults
- [ ] Frontend showing real-time IL data
- [ ] End-to-end transaction flow working

### Demo Impact
- [ ] Live IL calculation demonstration
- [ ] Successful policy enforcement
- [ ] Smooth user experience
- [ ] Clear value proposition communication

## 🗺️ Post-Hackathon Roadmap

### Week 1-2: Core Improvements
- Enhanced IL calculation algorithms
- Better error handling and monitoring
- UI/UX improvements based on feedback

### Week 3-4: Advanced Features  
- Multiple IL strategies (time-based, fee-adjusted)
- Integration with more DEX protocols
- Advanced analytics and reporting

### Month 2+: Production Ready
- Security audit and mainnet testing
- Governance token and DAO structure
- Insurance partnerships for IL coverage
- Mobile app development

## 🔧 Implementation Notes

This architecture leverages your existing Minswap DEX V2 codebase by:
- Reusing pool monitoring and calculation logic
- Adapting the Lucid integration patterns
- Extending the mathematical formulas for IL calculations
- Building on the proven batching and transaction patterns

The modular design allows for rapid development during the hackathon while maintaining extensibility for future enhancements.