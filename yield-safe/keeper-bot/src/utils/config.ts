import dotenv from "dotenv";
import { Network } from "lucid-cardano";

// Load environment variables
dotenv.config();

export interface KeeperConfig {
  network: Network;
  blockfrost: {
    url: string;
    apiKey: string;
  };
  keeper: {
    privateKey: string;
    defaultILThreshold: number; // in basis points (500 = 5%)
    maxOperationsPerHour: number;
    minVaultSize: number; // minimum vault size to monitor (in lovelace)
  };
  database: {
    path: string;
  };
  monitoredPools: Array<{
    poolId: string;
    assetA: {
      policyId: string;
      tokenName: string;
    };
    assetB: {
      policyId: string;
      tokenName: string;
    };
  }>;
  contracts: {
    vaultValidator: string;
    factoryValidator: string;
    keeperAuthPolicy: string;
    vaultNFTPolicy: string;
  };
  fees: {
    protocolFeeRate: number; // in basis points
    keeperRewardRate: number; // in basis points
  };
}

export async function loadConfig(): Promise<KeeperConfig> {
  const network = (process.env.CARDANO_NETWORK as Network) || "Preprod";
  
  // Validate required environment variables
  const requiredEnvVars = [
    "BLOCKFROST_API_KEY",
    "KEEPER_PRIVATE_KEY"
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
  
  const config: KeeperConfig = {
    network,
    blockfrost: {
      url: network === "Mainnet" 
        ? "https://cardano-mainnet.blockfrost.io/api/v0"
        : "https://cardano-preprod.blockfrost.io/api/v0",
      apiKey: process.env.BLOCKFROST_API_KEY!
    },
    keeper: {
      privateKey: process.env.KEEPER_PRIVATE_KEY!,
      defaultILThreshold: parseInt(process.env.DEFAULT_IL_THRESHOLD || "500"), // 5%
      maxOperationsPerHour: parseInt(process.env.MAX_OPERATIONS_PER_HOUR || "100"),
      minVaultSize: parseInt(process.env.MIN_VAULT_SIZE || "1000000") // 1 ADA
    },
    database: {
      path: process.env.DATABASE_PATH || "./data/keeper.db"
    },
    monitoredPools: JSON.parse(process.env.MONITORED_POOLS || JSON.stringify([
      {
        poolId: "example_pool_id",
        assetA: {
          policyId: "",
          tokenName: "ADA"
        },
        assetB: {
          policyId: "example_policy_id",
          tokenName: "example_token"
        }
      }
    ])),
    contracts: {
      vaultValidator: process.env.VAULT_VALIDATOR_ADDRESS || "",
      factoryValidator: process.env.FACTORY_VALIDATOR_ADDRESS || "",
      keeperAuthPolicy: process.env.KEEPER_AUTH_POLICY || "",
      vaultNFTPolicy: process.env.VAULT_NFT_POLICY || ""
    },
    fees: {
      protocolFeeRate: parseInt(process.env.PROTOCOL_FEE_RATE || "50"), // 0.5%
      keeperRewardRate: parseInt(process.env.KEEPER_REWARD_RATE || "25") // 0.25%
    }
  };
  
  return config;
}

// Environment file template
export const ENV_TEMPLATE = `
# Cardano Network Configuration
CARDANO_NETWORK=Preprod
BLOCKFROST_API_KEY=your_blockfrost_api_key_here

# Keeper Bot Configuration  
KEEPER_PRIVATE_KEY=your_keeper_private_key_here
DEFAULT_IL_THRESHOLD=500
MAX_OPERATIONS_PER_HOUR=100
MIN_VAULT_SIZE=1000000

# Database Configuration
DATABASE_PATH=./data/keeper.db

# Contract Addresses (will be populated after deployment)
VAULT_VALIDATOR_ADDRESS=
FACTORY_VALIDATOR_ADDRESS=
KEEPER_AUTH_POLICY=
VAULT_NFT_POLICY=

# Fee Configuration
PROTOCOL_FEE_RATE=50
KEEPER_REWARD_RATE=25

# Monitored Pools Configuration
MONITORED_POOLS=[{"poolId":"example","assetA":{"policyId":"","tokenName":"ADA"},"assetB":{"policyId":"example","tokenName":"token"}}]

# Logging
LOG_LEVEL=info
`;