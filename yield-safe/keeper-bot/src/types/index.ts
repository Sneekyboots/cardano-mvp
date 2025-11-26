// Core types for the Yield Safe keeper bot

export interface Asset {
  policyId: string;
  tokenName: string;
}

export interface AssetRatio {
  assetAAmount: bigint;
  assetBAmount: bigint;
}

export interface PoolState {
  reserveA: bigint;
  reserveB: bigint;
  totalLPTokens: bigint;
  lastUpdateTime: number; // POSIX timestamp
}

export interface ILData {
  initialRatio: AssetRatio;
  currentRatio: AssetRatio;
  ilPercentage: number; // in basis points (500 = 5%)
  hodlValue: bigint;
  lpValue: bigint;
}

export interface UserPolicy {
  maxILPercent: number; // in basis points
  depositRatio: AssetRatio;
  emergencyWithdraw: boolean;
  autoExitEnabled: boolean;
  notificationThreshold: number; // in basis points
}

export interface VaultData {
  owner: string; // bech32 address
  policy: UserPolicy;
  lpAsset: Asset;
  poolAssets: [Asset, Asset];
  depositAmount: bigint;
  depositTime: number; // POSIX timestamp
  initialPoolState: PoolState;
  vaultId: string; // unique identifier
}

export interface KeeperAuth {
  keeperPubkey: string;
  authorizedUntil: number; // POSIX timestamp
  maxOperationsPerHour: number;
}

export interface PoolMonitorData {
  poolId: string;
  assetA: Asset;
  assetB: Asset;
  currentState: PoolState;
  priceHistory: AssetRatio[];
  lastMonitorTime: number;
}

export interface VaultOperation {
  vaultId: string;
  operationType: "deposit" | "withdraw" | "policy_update" | "emergency_exit" | "keeper_exit";
  amount?: bigint;
  ilData?: ILData;
  timestamp: number;
  txHash?: string;
  keeperAddress?: string;
}

export interface KeeperMetrics {
  totalVaultsMonitored: number;
  totalValueProtected: bigint; // in lovelace
  successfulProtections: number;
  averageILProtected: number; // in basis points
  totalRewardsEarned: bigint;
  uptime: number; // in seconds
  lastHealthCheck: number;
}

export interface AlertLevel {
  level: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: number;
  vaultId?: string;
  poolId?: string;
}

export interface DatabaseVault {
  id: string;
  owner: string;
  lpAsset: string; // JSON string
  poolAssets: string; // JSON string  
  depositAmount: string; // bigint as string
  depositTime: number;
  policy: string; // JSON string
  initialPoolState: string; // JSON string
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DatabasePoolState {
  id: number;
  poolId: string;
  reserveA: string; // bigint as string
  reserveB: string; // bigint as string
  totalLPTokens: string; // bigint as string
  timestamp: number;
  blockHeight: number;
}

export interface DatabaseOperation {
  id: number;
  vaultId: string;
  operationType: string;
  amount?: string; // bigint as string
  ilData?: string; // JSON string
  timestamp: number;
  txHash?: string;
  keeperAddress?: string;
  success: boolean;
  errorMessage?: string;
}

export interface PriceData {
  assetPair: [Asset, Asset];
  ratio: AssetRatio;
  timestamp: number;
  source: "pool" | "oracle" | "aggregated";
  confidence: number; // 0-100
}

export interface ILProtectionTrigger {
  vaultId: string;
  currentIL: number; // basis points
  maxAllowed: number; // basis points
  recommendedAction: "alert" | "auto_exit" | "manual_review";
  urgency: "low" | "medium" | "high";
  estimatedLoss: bigint; // potential loss in lovelace
}

// Transaction building types
export interface TxInput {
  txHash: string;
  outputIndex: number;
  address: string;
  assets: Record<string, bigint>;
  datum?: string;
  datumHash?: string;
  scriptRef?: string;
}

export interface TxOutput {
  address: string;
  assets: Record<string, bigint>;
  datum?: string;
  datumHash?: string;
  scriptRef?: string;
}

export interface BuiltTransaction {
  inputs: TxInput[];
  outputs: TxOutput[];
  fee: bigint;
  validityRange: {
    validFrom?: number;
    validTo?: number;
  };
  requiredSigners: string[];
  metadata?: Record<string, any>;
}