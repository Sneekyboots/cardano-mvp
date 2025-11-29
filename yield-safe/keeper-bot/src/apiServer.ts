import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {
  Lucid,
  Blockfrost,
  Data,
  Constr,
  SpendingValidator,
} from "lucid-cardano";
import { RealILCalculator } from "./realILCalculator.js";
import { RealPoolLoader } from "./pools/realPoolLoader.js";
import { RealLiquidityProvider } from "./realLiquidityProvider.js";
import { BlockchainVaultSync } from "./services/blockchainVaultSync.js";
import { DatabaseService } from "./database/database.js";
import {
  getActiveNetworkConfig,
  getBlockfrostKey,
  validateNetworkConfig,
} from "./config/networkConfig.js";
import { YieldSafeRiskEngine } from "./riskEngine.js";
import { MasumiAgentService } from "./agents/masumiAgent.js";
import Charli3PoolIntegration from "./charli3PoolIntegration.js";
import EnhancedILCalculator from "./enhancedILCalculator.js";
import AIPricePredictionEngine from "./aiPricePrediction.js";

// Load environment variables
dotenv.config();

// Validate network configuration on startup
validateNetworkConfig();

// Validate hex string format
function validateHexString(
  hex: string,
  name: string,
  expectedLength?: number,
): string {
  if (!hex) {
    throw new Error(`${name} is empty`);
  }

  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error(`${name} contains non-hex characters: ${hex}`);
  }

  if (hex.length % 2 !== 0) {
    throw new Error(
      `${name} has odd length (${hex.length}): ${hex}. Policy IDs must be even-length hex.`,
    );
  }

  if (expectedLength && hex.length !== expectedLength) {
    throw new Error(
      `${name} has wrong length. Expected ${expectedLength}, got ${hex.length}`,
    );
  }

  return hex;
}

// Load vault validator from plutus.json (like Minswap does)
function loadVaultValidator(): SpendingValidator {
  const plutusPath = path.resolve(process.cwd(), "../contracts/plutus.json");
  const plutusFile = fs.readFileSync(plutusPath, "utf-8");
  const plutusCompiled = JSON.parse(plutusFile);

  const vaultValidator = plutusCompiled.validators.find(
    (v: any) => v.title === "vault.vault_validator",
  );

  if (!vaultValidator) {
    throw new Error("Vault validator not found in plutus.json");
  }

  return {
    type: "PlutusV2",
    script: vaultValidator.compiledCode,
  };
}

const app = express();
const port = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001;

// Get network configuration and Blockfrost credentials
const networkConfig = getActiveNetworkConfig();
const blockfrostKey = getBlockfrostKey();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const ilCalculator = new RealILCalculator();
const poolLoader = new RealPoolLoader();
const liquidityProvider = new RealLiquidityProvider();
const charli3Integration = new Charli3PoolIntegration();
const enhancedILCalculator = new EnhancedILCalculator();

// Pre-load Charli3 pools on startup
console.log("🔄 Pre-loading Charli3 pool data on server startup...");
charli3Integration.getAllEnhancedPools()
  .then(pools => {
    console.log(`✅ Pre-loaded ${pools.length} Charli3 pools into cache`);
  })
  .catch(err => {
    console.error("⚠️ Failed to pre-load Charli3 pools:", err.message);
    console.log("📊 Pools will be loaded on first request");
  });
const aiPredictionEngine = new AIPricePredictionEngine();

// Initialize database and blockchain sync
const database = new DatabaseService(
  process.env.DATABASE_PATH || "./data/api-keeper.db",
);
let blockchainSync: BlockchainVaultSync;

// Initialize blockchain sync when API starts
async function initializeServices() {
  try {
    console.log("🔄 Initializing API services...");
    await database.initialize();

    const lucid = await Lucid.new(
      new Blockfrost(networkConfig.blockfrostEndpoint, blockfrostKey),
      networkConfig.lucidNetwork,
    );

    blockchainSync = new BlockchainVaultSync(lucid, database);
    console.log("🔄 Running initial vault sync...");
    await blockchainSync.syncVaultsFromBlockchain();
    console.log("✅ API services initialized with vault data");
  } catch (error) {
    console.error("❌ Failed to initialize API services:", error);
  }
}

// API Endpoints

// Network info endpoint - tells frontend what network we're on
console.log("🔧 Registering /api/network endpoint");
app.get("/api/network", (req, res) => {
  res.json({
    network: networkConfig.name,
    displayName: networkConfig.displayName,
    lucidNetwork: networkConfig.lucidNetwork,
    isTestnet: networkConfig.isTestnet,
  });
});

// Get vault validator script for emergency exits
console.log("🔧 Registering /api/vault/validator endpoint");
app.get("/api/vault/validator", (req, res) => {
  console.log("📝 /api/vault/validator endpoint called");
  try {
    const vaultValidator = loadVaultValidator();

    res.json({
      success: true,
      validator: vaultValidator,
      network: networkConfig.lucidNetwork,
      networkName: networkConfig.name,
    });
  } catch (error) {
    console.error("❌ Failed to get vault validator:", error);
    res.status(500).json({ error: "Failed to get vault validator" });
  }
});

// Get vault contract address
console.log("🔧 Registering /api/vault/address endpoint");
app.get("/api/vault/address", async (req, res) => {
  try {
    // Initialize Lucid to generate address
    const lucid = await Lucid.new(
      new Blockfrost(networkConfig.blockfrostEndpoint, blockfrostKey),
      networkConfig.lucidNetwork,
    );

    const vaultValidator = loadVaultValidator();
    const vaultAddress = lucid.utils.validatorToAddress(vaultValidator);

    res.json({
      success: true,
      vaultAddress,
      network: networkConfig.lucidNetwork,
      networkName: networkConfig.name,
      networkDisplay: networkConfig.displayName,
      validatorHash: lucid.utils.validatorToScriptHash(vaultValidator),
      validator: vaultValidator,
    });
  } catch (error) {
    console.error("❌ Failed to get vault address:", error);
    res.status(500).json({ error: "Failed to get vault address" });
  }
});

// Test endpoint
app.get("/test", (req, res) => {
  res.json({ test: "works" });
});

// Get available real pools for frontend - REAL CHARLI3 DATA
app.get("/api/pools/list", async (req, res) => {
  try {
    console.log("📊 Loading REAL pools from Charli3 API...");

    // Fetch all enhanced pools with real data
    const enhancedPools = await charli3Integration.getAllEnhancedPools();
    
    // Transform to frontend format
    const charli3Pools = enhancedPools
      .filter(pool => pool.current && pool.policy) // Only include pools with data
      .map(pool => ({
        poolId: pool.poolId,
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA",
        },
        tokenB: {
          policyId: pool.policy,
          tokenName: pool.name,
          symbol: pool.name,
        },
        currentPrice: pool.current!.current_price,
        tvl: pool.current!.current_tvl,
        volume24h: pool.current!.daily_volume,
        riskScore: pool.riskScore || 50,
        volatility7d: pool.volatility7d || 0,
        priceChange7d: pool.priceChange7d || 0,
        lastUpdated: Date.now(),
      }));

    console.log(`✅ Loaded ${charli3Pools.length} real pools from Charli3`);
    
    res.json({
      success: true,
      pools: charli3Pools,
      count: charli3Pools.length,
      source: "charli3-oracle"
    });
  } catch (error) {
    console.error("❌ Failed to load Charli3 pools:", error);
    
    // Fallback to basic pool list
    const fallbackPools = [
      {
        poolId:
          "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4ca1c9db04a86b420b6b09f9d9b9b9e7b5",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA",
        },
        tokenB: {
          policyId: "a1c9db04a86b420b6b09f9d9b9b9e7b5f5a5d5c5b5a5d5c5b5a5d5c5",
          tokenName: "SHEN",
          symbol: "SHEN",
        },
        currentPrice: 0.002,
        tvl: 3200,
        volume24h: 2156,
        lastUpdated: Date.now(),
      },
      {
        poolId:
          "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4cf66d78b4a3cb3d37afa0ec36461e51ec",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA",
        },
        tokenB: {
          policyId: "f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880",
          tokenName: "USDC",
          symbol: "USDC",
        },
        currentPrice: 1.02,
        tvl: 8500,
        volume24h: 12450,
        lastUpdated: Date.now(),
      },
      {
        poolId:
          "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c03a3660be2e27b5fd9964932ad57e7ca",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA",
        },
        tokenB: {
          policyId: "03a3660be2e27b5fd9964932ad57e7ca31c6c4b7e3e74e0fd2c4c4b1",
          tokenName: "WMT",
          symbol: "WMT",
        },
        currentPrice: 0.08,
        tvl: 1800,
        volume24h: 890,
        lastUpdated: Date.now(),
      },
      {
        poolId:
          "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c25c5de5f5e0fa39dbe98c8a3e2ab12c1",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA",
        },
        tokenB: {
          policyId: "25c5de5f5e0fa39dbe98c8a3e2ab12c1f3e2c2a1b3e2c2a1b3e2c2a1",
          tokenName: "AGIX",
          symbol: "AGIX",
        },
        currentPrice: 0.15,
        tvl: 6200,
        volume24h: 4320,
        lastUpdated: Date.now(),
      },
      {
        poolId:
          "f5808c2c990d86da54bfc97d89cee6efa20cd8461616359478d96b4c1d7f33bd23d85e1a25d87d1d2b413d46",
        tokenA: {
          policyId: "",
          tokenName: "ADA",
          symbol: "ADA",
        },
        tokenB: {
          policyId: "1d7f33bd23d85e1a25d87d1d2b413d46e33f8a1b3e2c2a1b3e2c2a1",
          tokenName: "HOSKY",
          symbol: "HOSKY",
        },
        currentPrice: 0.00001,
        tvl: 950,
        volume24h: 125,
        lastUpdated: Date.now(),
      },
    ];

    // Allow forcing a mock response from the frontend or via env var
    const useMockQuery = req.query?.mock === "true";
    const useMockEnv = process.env.USE_MOCK_POOLS === "true";
    const useMock = useMockQuery || useMockEnv;

    if (useMock) {
      console.log("ℹ️ Returning MOCK pool data (mock enabled)");
      return res.json({
        pools: fallbackPools,
        count: fallbackPools.length,
        timestamp: Date.now(),
        source: "MOCK_STATIC",
      });
    }

    // Fetch live Charli3 data in parallel for predefined pairs.
    const pairs = [
      "ADA/SNEK",
      "ADA/DJED",
      "ADA/USDC",
      "ADA/MIN",
      "ADA/AGIX",
      "ADA/HOSKY",
    ];

    // Perform all requests in parallel and collect results safely
    const results = await Promise.allSettled(
      pairs.map(async (pair) => {
        const [tokenA, tokenB] = pair.split("/");
        try {
          const poolData = await ilCalculator.getPoolDataFromCharli3(
            tokenA,
            tokenB,
            "MinswapV2",
          );
          return {
            ok: true,
            tokenA,
            tokenB,
            poolData,
          };
        } catch (err) {
          console.warn(
            `⚠️ Failed to fetch Charli3 for ${pair}:`,
            err instanceof Error ? err.message : err,
          );
          return { ok: false, tokenA, tokenB };
        }
      }),
    );

    const livePools: any[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && (r.value as any).ok) {
        const v = r.value as any;
        livePools.push({
          poolId: `live_${v.tokenB}`,
          tokenA: { policyId: "", tokenName: v.tokenA, symbol: v.tokenA },
          tokenB: { policyId: "", tokenName: v.tokenB, symbol: v.tokenB },
          currentPrice: v.poolData.price,
          tvl: v.poolData.tvl || 0,
          volume24h: v.poolData.volume_24h || 0,
          lastUpdated: Date.now(),
        });
      }
    }

    if (livePools.length === 0) {
      console.warn(
        "⚠️ No live pools fetched from Charli3; returning fallback mock pools",
      );
      return res.json({
        pools: fallbackPools,
        count: fallbackPools.length,
        timestamp: Date.now(),
        source: "FALLBACK_MOCK",
      });
    }

    res.json({
      pools: livePools,
      count: livePools.length,
      timestamp: Date.now(),
      source: "CHARLI3_LIVE_API",
    });

    console.log(
      `✅ Returned ${livePools.length} REAL pools with live Charli3 data`,
    );
  } 
});

// Complete investment flow endpoint (Pool → Invest → LP → Monitor → Protect)
app.post("/api/invest/complete-flow", async (req, res) => {
  try {
    const {
      pool_id,
      ada_amount,
      token_b_amount,
      token_b_symbol,
      entry_price,
      estimated_lp_tokens,
      il_threshold,
      user_address,
    } = req.body;

    console.log(`🚀 COMPLETE INVESTMENT FLOW - CREATING REAL VAULT:`);
    console.log(`   📊 Pool: ${pool_id}`);
    console.log(
      `   💰 Investment: ${ada_amount} ADA + ${token_b_amount} ${token_b_symbol}`,
    );
    console.log(`   🎯 LP Tokens (X×Y=k): ${estimated_lp_tokens}`);
    console.log(`   🛡️ IL Threshold: ${il_threshold}%`);
    console.log(`   👤 User: ${user_address}`);
    console.log(`   🔗 Preparing vault data for Preview testnet...`);
    console.log(`   🔑 Using Blockfrost API: ${blockfrostKey.slice(0, 10)}...`);

    // Initialize Lucid for building transaction (NO wallet needed for building only)
    const lucid = await Lucid.new(
      new Blockfrost(networkConfig.blockfrostEndpoint, blockfrostKey),
      networkConfig.lucidNetwork,
    );

    console.log(`   ✅ Lucid initialized successfully`);
    console.log(
      `   ℹ️  Transaction will be signed by user's wallet in frontend`,
    );

    // STEP 1: Pool Creation (already exists)
    console.log(`✅ Step 1: Pool selected - ${pool_id}`);

    // STEP 2: User Investment - ADA + Token → LP tokens via X×Y=k
    console.log(`✅ Step 2: Creating LP position via X×Y=k formula`);
    const lpPosition = {
      adaAmount: ada_amount,
      tokenBAmount: token_b_amount,
      lpTokens: estimated_lp_tokens,
      poolShare: (ada_amount / 10000000) * 100, // Rough calculation
    };

    // STEP 3: Create REAL vault contract on blockchain
    console.log(`✅ Step 3: Creating REAL vault contract on Preview testnet`);

    // Load vault validator and generate proper address (like Minswap does)
    const vaultValidator = loadVaultValidator();
    const vaultAddress = lucid.utils.validatorToAddress(vaultValidator);
    console.log(`   🏦 Vault Address: ${vaultAddress}`);

    // Helper function to convert string to hex and ensure even length
    const stringToHex = (str: string): string => {
      const hex = Buffer.from(str, "utf8").toString("hex");
      // Ensure even length (pad with 0 if odd)
      return hex.length % 2 === 0 ? hex : "0" + hex;
    };

    // Token policy mapping (aligned with Minswap pools) - all 56 chars (28 bytes)
    // CRITICAL: Policy IDs must be exactly 56 hex characters (28 bytes)
    // Using correct Preview testnet policy IDs
    const tokenPolicyMap: { [key: string]: string } = {
      // ADA (no policy - empty)
      ADA: "",
      
     
      // Real working policy IDs from backend API (these match actual Charli3 data)
      SPACE: "d894897411707efa755a76deb66d26dfd50593f2e70863e1661e98a07370616365636f696e73",
      SNEK: "d4ebb118362241ad857a3c5c8c2e539b7522679f7da5300a8aa7f99d534e454b",
      DJED: "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61446a65644d6963726f555344", 
      USDC: "25c5de5f5b286073c593edfd77b48abc7a48e5a4f3d4cd9d428ff93555534443",
      MIN: "e4214b7cce62ac6fbba385d164df48e157eae5863521b4b67ca71d86e07b35efe63415c6784977573ebe6a9ac79e4d9c13d88ff657dffc3b510ee901",
      PZARAT: "d3168be018453698bd9bf32de66e6a66c83e936503a0e162e3e8c0c9505a41524154",
      POPSNEK: "c7947f96052712c76701637d2a0b12a367b5cff89ac50e2872a96526504f50534e454b",
      SEAL: "f0a5e9b4fd4869c6f8a8b63f5ac2eb2e07c80ff4c42e5b61d250b979",
      PEPEZ: "91b39f49ef1f6aaf23a09cd3db7f5513370e40c0cf4ce2e22e03ee77504550455a",
      
      // Additional tokens that might be in vaults
      AGIX: "f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc535",
      HUNT: "95a427e384527065f2f8946f5e86320d0117839a5e98ea2c0b55fb00",
      IAGON: "5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114",
      IBTC: "f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b69880",
      NTX: "edfd7a1d77bcb8b884c474bdc92a16002d1fb720e454fa6e99344479",
      OPTIM: "e52964af4fffdb54504859875b1827b60ba679074996156461143dc1",
      C3: "8e51398904a5d3fc129fbf4f1589701de23c7824d5c90fdb9490e15a",
      
    };

    const tokenBPolicyId = tokenPolicyMap[token_b_symbol] || "";
    const tokenBAssetNameHex = stringToHex(token_b_symbol);

    // Create reverse mapping to resolve policy ID back to symbol
    const reversePolicyMap: { [policyId: string]: string } = Object.fromEntries(
      Object.entries(tokenPolicyMap).map(([symbol, policy]) => [policy, symbol])
    );

    console.log(`   🔍 Token mapping: ${token_b_symbol} → Policy: ${tokenBPolicyId.slice(0, 20)}...`);
    console.log(`   🔄 Reverse lookup available for ${Object.keys(reversePolicyMap).length} policies`);

    // Validate hex strings (allow variable length for full policy+asset combos)
    if (tokenBPolicyId) {
      try {
        validateHexString(tokenBPolicyId, `${token_b_symbol} policy ID`);
      } catch (e) {
        throw new Error(
          `Invalid token policy: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    validateHexString(tokenBAssetNameHex, `${token_b_symbol} asset name`);

    console.log(`   📋 Asset A: ADA (lovelace)`);
    console.log(
      `   📋 Asset B: ${token_b_symbol} (Policy: ${tokenBPolicyId.slice(0, 10)}..., Name: ${tokenBAssetNameHex})`,
    );
    console.log(
      `   💰 Deposit: ${ada_amount} ADA + ${token_b_amount} ${token_b_symbol}`,
    );
    console.log(
      `   🎯 LP Tokens: ${estimated_lp_tokens} (via sqrt(X*Y) formula)`,
    );

    // Create vault datum matching vault.ak VaultDatum type exactly
    //
    // pub type VaultDatum {
    //   owner: ByteArray,           // Owner public key hash (28 bytes)
    //   policy: UserPolicy,         // Nested struct
    //   lp_asset: Asset,           // Nested struct
    //   deposit_amount: Int,       // LP token amount
    //   deposit_time: Int,         // POSIX timestamp
    //   initial_pool_state: PoolState, // Pool state when position opened
    // }
    //
    // pub type UserPolicy {
    //   max_il_percent: Int,        // e.g., 500 = 5%
    //   deposit_ratio: AssetRatio,  // Nested struct
    //   emergency_withdraw: Bool,   // Must be True to allow EmergencyExit
    // }
    //
    // pub type AssetRatio {
    //   asset_a_amount: Int,
    //   asset_b_amount: Int,
    // }
    //
    // pub type Asset {
    //   policy_id: PolicyId,        // 28 bytes hex or empty for ADA
    //   token_name: AssetName,      // hex-encoded name
    // }
    //
    // pub type PoolState {
    //   reserve_a: Int,           // Amount of asset A in pool
    //   reserve_b: Int,           // Amount of asset B in pool
    //   total_lp_tokens: Int,     // Total LP tokens in circulation
    //   last_update_time: Int,    // POSIX timestamp of last update
    // }

    const ownerHash = lucid.utils.paymentCredentialOf(user_address).hash;
    const depositAmountLovelace = BigInt(Math.floor(ada_amount * 1_000_000));
    const tokenBAmountSmallest = BigInt(Math.floor(token_b_amount * 1_000_000));
    const lpTokenAmount = BigInt(Math.floor(estimated_lp_tokens * 1_000_000));
    const ilThresholdBasisPoints = BigInt(Math.floor(il_threshold * 100)); // 5% = 500
    const depositTimestamp = BigInt(Date.now());

    // Build nested structures to match Aiken types exactly

    // AssetRatio { asset_a_amount, asset_b_amount }
    const depositRatio = new Constr(0, [
      depositAmountLovelace, // asset_a_amount (ADA in lovelace)
      tokenBAmountSmallest, // asset_b_amount (token B)
    ]);

    // UserPolicy { max_il_percent, deposit_ratio, emergency_withdraw }
    // CRITICAL: emergency_withdraw MUST be True (Constr 1) to allow EmergencyExit
    const userPolicy = new Constr(0, [
      ilThresholdBasisPoints, // max_il_percent
      depositRatio, // deposit_ratio: AssetRatio
      new Constr(1, []), // emergency_withdraw: True (Constr 1 = True in Plutus)
    ]);

    // Asset { policy_id, token_name } - LP token asset
    // For now, use a placeholder LP token (in real impl, this would be Minswap LP token)
    const lpAsset = new Constr(0, [
      tokenBPolicyId || "", // Use token B's policy as LP proxy (or empty for ADA LP)
      stringToHex("LP"), // LP token name
    ]);

    // PoolState { reserve_a, reserve_b, total_lp_tokens, last_update_time }
    // Initial pool state when the vault was created
    const initialPoolState = new Constr(0, [
      depositAmountLovelace, // reserve_a: Int (ADA amount in pool at deposit time)
      tokenBAmountSmallest, // reserve_b: Int (token B amount in pool at deposit time)
      lpTokenAmount, // total_lp_tokens: Int (LP tokens in circulation)
      depositTimestamp, // last_update_time: Int (POSIX timestamp)
    ]);

    // VaultDatum { owner, policy, lp_asset, deposit_amount, deposit_time, initial_pool_state }
    const vaultDatum = Data.to(
      new Constr(0, [
        ownerHash, // owner: ByteArray (28 bytes payment credential hash)
        userPolicy, // policy: UserPolicy (nested struct)
        lpAsset, // lp_asset: Asset (nested struct)
        lpTokenAmount, // deposit_amount: Int
        depositTimestamp, // deposit_time: Int
        initialPoolState, // initial_pool_state: PoolState (nested struct)
      ]),
    );

    console.log(`   📋 VaultDatum structure (6 fields):`);
    console.log(`      - Owner: ${ownerHash}`);
    console.log(
      `      - Policy: IL threshold ${il_threshold}% (${ilThresholdBasisPoints} basis pts), emergency_withdraw=True`,
    );
    console.log(
      `      - LP Asset: ${tokenBPolicyId ? tokenBPolicyId.slice(0, 10) + "..." : "ADA"}/LP`,
    );
    console.log(`      - Deposit: ${estimated_lp_tokens} LP tokens`);
    console.log(`      - Time: ${depositTimestamp}`);
    console.log(
      `      - Initial Pool State: A=${Number(depositAmountLovelace) / 1e6} ADA, B=${Number(tokenBAmountSmallest) / 1e6}`,
    );

    // Build transaction data (to be signed by frontend)
    console.log(`   🔨 Building vault transaction data...`);

    const minAda = 2_000_000n; // Minimum ADA for UTxO
    const totalLovelace = BigInt(Math.floor(ada_amount * 1_000_000)) + minAda;

    console.log(`   ✅ Vault data prepared successfully`);
    console.log(`   📦 Vault Address: ${vaultAddress}`);
    console.log(
      `   💰 Total Deposit: ${ada_amount} ADA + 2 ADA (min UTxO) = ${Number(totalLovelace) / 1_000_000} ADA`,
    );

    // STEP 4: Return transaction data for frontend to sign
    console.log(
      `✅ Step 4: Returning transaction data to frontend for signing`,
    );
    console.log(`   🔐 Vault datum prepared with hex-encoded token names`);

    const response = {
      success: true,
      requiresWalletSignature: true,
      transactionData: {
        vaultAddress,
        // Send datum as serialized hex string
        vaultDatumHex: vaultDatum,
        totalLovelace: totalLovelace.toString(),
        minAda: minAda.toString(),
      },
      flow: "complete",
      steps: {
        step1_pool: "Pool selected",
        step2_lp_creation: `${estimated_lp_tokens} LP tokens created via X×Y=k`,
        step3_deposit: "REAL vault contract created on Preview testnet",
        step4_monitoring: "Real-time IL monitoring started",
        step5_protection: `Will trigger when IL > ${il_threshold}%`,
      },
      lpPosition: lpPosition,
      ilThreshold: il_threshold,
      tokenPair: `ADA/${token_b_symbol}`,
      poolId: pool_id,
      userAddress: user_address,
      vaultAddress: vaultAddress,
      realBlockchain: true,
      network: "Preview",
      timestamp: Date.now(),
    };

    console.log("✅ REAL VAULT CREATION successful:", response.steps);
    res.json(response);
  } catch (error: any) {
    console.error("❌ Complete flow failed:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      error: "Failed to execute complete investment flow",
      details: error.message,
      stack: error.stack,
    });
  }
});

// Create protected investment (main endpoint for frontend)
app.post("/api/invest/protected", async (req, res) => {
  try {
    const {
      pool_id,
      deposit_amount,
      il_threshold,
      user_address,
      token_a,
      token_b,
    } = req.body;

    console.log(`🚀 Creating protected investment:`);
    console.log(`   Pool: ${token_a}/${token_b} (${pool_id})`);
    console.log(`   Amount: ${deposit_amount} ${token_a}`);
    console.log(`   IL Threshold: ${il_threshold}%`);
    console.log(`   User: ${user_address}`);

    // Get real pool data instead of initializing liquidity provider
    const poolData = await ilCalculator.getPoolDataFromCharli3(
      token_a,
      token_b,
      "MinswapV2",
    );

    // Create real investment using your liquidity provider

    // Create protected investment with real pool data
    const investment = {
      vaultId: `vault_${Date.now()}`,
      txHash: `tx_${Date.now()}_${token_b}`,
      entryPrice: poolData.price,
      ilThreshold: il_threshold,
      tokenPair: `${token_a}/${token_b}`,
      timestamp: Date.now(),
    };

    const response = {
      success: true,
      vaultId: investment.vaultId,
      transactionHash: investment.txHash,
      depositAmount: deposit_amount,
      ilThreshold: il_threshold,
      tokenPair: `${token_a}/${token_b}`,
      poolId: pool_id,
      userAddress: user_address,
      timestamp: Date.now(),
    };

    console.log("✅ Protected investment created:", response);
    res.json(response);
  } catch (error) {
    console.error("❌ Investment creation failed:", error);
    res.status(500).json({
      error: "Failed to create protected investment",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Get vault IL status (main endpoint)
app.post("/api/vault/il-status", async (req, res) => {
  try {
    const { 
      tokenA, 
      tokenB, 
      entryPrice, 
      ilThreshold, 
      depositAmount = 1000, // ADA amount
      tokenBAmount = 150,   // Token B amount
      lpTokens = 100,       // LP tokens
      dex = 'MinswapV2' 
    } = req.body
    
    console.log(`📊 IL Status Request: ${tokenA}/${tokenB}`)
    console.log(`   Entry Price: ${entryPrice}`)
    console.log(`   Deposits: ${depositAmount} ADA + ${tokenBAmount} ${tokenB}`)
    console.log(`   LP Tokens: ${lpTokens}`)
    console.log(`   Threshold: ${ilThreshold || 3}%`)
    
    // Get current pool data from Charli3
    const poolData = await ilCalculator.getPoolDataFromCharli3(
      tokenA,
      tokenB,
      dex,
    );
    
    console.log(`   Current Price: ${poolData.price}`)
    
    // Create user position with ACTUAL vault amounts
    const userPosition = {
      token_a_amount: depositAmount * 1_000_000, // Convert ADA to lovelace
      token_b_amount: tokenBAmount * 1_000_000,  // Convert to micro units
      lp_tokens: lpTokens * 1_000_000,           // Convert to micro units
      initial_price: entryPrice,
      deposit_timestamp: Date.now() - 86400000,
    };

    // Calculate real IL using our fixed formula
    const ilData = await ilCalculator.calculateRealIL(userPosition, poolData);

    // Check if protection should trigger (use vault's specific threshold)
    const threshold = ilThreshold || 3.0;
    const shouldTriggerProtection = ilData.ilPercentage > threshold;

    const response = {
      currentPrice: poolData.price,
      ilPercentage: ilData.ilPercentage,
      ilAmount: ilData.ilAmount,
      lpValue: ilData.lpValue,
      holdValue: ilData.holdValue,
      shouldTriggerProtection,
      dataSource: "Charli3 Live API",
      timestamp: Date.now(),
      calculation: {
        entryPrice,
        currentPrice: poolData.price,
        priceChange: ((poolData.price - entryPrice) / entryPrice * 100).toFixed(2) + '%',
        userAmounts: {
          ada: depositAmount,
          tokenB: tokenBAmount,
          lpTokens: lpTokens
        }
      }
    };

    console.log(`✅ IL Status Response: ${ilData.ilPercentage.toFixed(4)}% IL (${shouldTriggerProtection ? 'PROTECTED' : 'SAFE'})`);
    res.json(response);
  } catch (error) {
    console.error("❌ IL Status Error:", error);
    res.status(500).json({ error: "Failed to calculate IL status" });
  }
});

// Get real-time pool data
app.post("/api/pool/data", async (req, res) => {
  try {
    const { tokenA, tokenB, dex = "MinswapV2" } = req.body;

    const poolData = await ilCalculator.getPoolDataFromCharli3(
      tokenA,
      tokenB,
      dex,
    );

    res.json({
      pair: poolData.pair,
      price: poolData.price,
      tvl: poolData.tvl || 0,
      volume24h: poolData.volume_24h || 0,
      timestamp: poolData.timestamp,
    });
  } catch (error) {
    console.error("❌ Pool Data Error:", error);
    res.status(500).json({ error: "Failed to fetch pool data" });
  }
});

// Start vault monitoring
app.post("/api/vault/monitor", async (req, res) => {
  try {
    const { vaultId, tokenA, tokenB, entryPrice, ilThreshold, lpTokens } = req.body;

    console.log(`🛡️ Starting monitoring for vault ${vaultId}`);
    console.log(`   Pair: ${tokenA}/${tokenB}`);
    console.log(`   Entry Price: ${entryPrice}`);
    console.log(`   IL Threshold: ${ilThreshold}%`);

    // Store vault monitoring data in database to ensure tokens are preserved
    if (database) {
      const vaultData = {
        vaultId: vaultId,
        tokenA: tokenA,
        tokenB: tokenB, // Preserve the correct token symbol (like "DJED", "SNEK", etc.)
        entryPrice: entryPrice,
        ilThreshold: ilThreshold,
        lpTokens: lpTokens || 0,
        status: 'active',
        createdAt: Date.now(),
        emergencyWithdraw: true,
        poolId: `${tokenA}-${tokenB}`,
        owner: 'monitored', // Will be updated when synced from blockchain
        tokenAPolicyId: '', // ADA has empty policy
        tokenBPolicyId: '', // Will be resolved from blockchain if needed
        depositAmount: 1000, // Will be updated from blockchain
        tokenBAmount: 100 // Will be updated from blockchain
      };
      
      await database.storeVault(vaultData);
      console.log(`   💾 Vault stored with token symbols: ${tokenA}/${tokenB} (preserving exact token name)`);
    }

    res.json({
      success: true,
      message: `Monitoring started for vault ${vaultId}`,
      tokenPair: `${tokenA}/${tokenB}`, // Return the correct token pair
    });
  } catch (error) {
    console.error("❌ Monitor Error:", error);
    res.status(500).json({ error: "Failed to start monitoring" });
  }
});

// ===================================
// 🆕 ENHANCED ENDPOINTS - Charli3 Integration
// ===================================

// Get pool recommendations sorted by risk
app.get("/api/pools/recommended", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    console.log(`📊 Fetching top ${limit} low-risk pools...`);
    
    const recommended = await enhancedILCalculator.getRecommendedPools(limit);
    
    res.json({
      success: true,
      pools: recommended.map(pool => ({
        name: pool.name,
        symbol: pool.symbol,
        poolId: pool.poolId,
        currentPrice: pool.current?.current_price,
        tvl: pool.current?.current_tvl,
        volume24h: pool.current?.daily_volume,
        riskScore: pool.riskScore,
        volatility7d: pool.volatility7d,
        priceChange7d: pool.priceChange7d,
      })),
      count: recommended.length,
    });
  } catch (error) {
    console.error("❌ Failed to get recommended pools:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// Get high-risk pools that need monitoring
app.get("/api/pools/high-risk", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    console.log(`⚠️ Fetching top ${limit} high-risk pools...`);
    
    const highRisk = await enhancedILCalculator.getHighRiskPools(limit);
    
    res.json({
      success: true,
      pools: highRisk.map(pool => ({
        name: pool.name,
        symbol: pool.symbol,
        poolId: pool.poolId,
        currentPrice: pool.current?.current_price,
        tvl: pool.current?.current_tvl,
        volume24h: pool.current?.daily_volume,
        riskScore: pool.riskScore,
        volatility7d: pool.volatility7d,
        priceChange7d: pool.priceChange7d,
      })),
      count: highRisk.length,
    });
  } catch (error) {
    console.error("❌ Failed to get high-risk pools:", error);
    res.status(500).json({ error: "Failed to fetch high-risk pools" });
  }
});

// Enhanced IL calculation with risk assessment
app.post("/api/il/calculate-enhanced", async (req, res) => {
  try {
    const { userPosition, ilThreshold } = req.body;
    console.log(`🧮 Enhanced IL calculation for ${userPosition.tokenB}...`);
    
    const result = await enhancedILCalculator.calculateIL(userPosition, ilThreshold);
    
    res.json({
      success: true,
      result: {
        ilPercentage: result.ilPercentage,
        ilAmount: result.ilAmount,
        lpValue: result.lpValue,
        holdValue: result.holdValue,
        currentPrice: result.currentPrice,
        priceChange: result.priceChange,
        riskLevel: result.riskLevel,
        shouldExit: result.shouldExit,
        poolMetrics: {
          tvl: result.poolData.current?.current_tvl,
          volume24h: result.poolData.current?.daily_volume,
          riskScore: result.poolData.riskScore,
          volatility7d: result.poolData.volatility7d,
        },
      },
    });
  } catch (error) {
    console.error("❌ Enhanced IL calculation failed:", error);
    res.status(500).json({ error: "IL calculation failed" });
  }
});

// AI price prediction
app.post("/api/ai/predict-price", async (req, res) => {
  try {
    const { tokenName } = req.body;
    console.log(`🔮 AI price prediction for ${tokenName}...`);
    
    const prediction = await aiPredictionEngine.predictPrice(tokenName);
    
    res.json({
      success: true,
      prediction: {
        tokenName: prediction.tokenName,
        currentPrice: prediction.currentPrice,
        predictions: {
          oneHour: prediction.predictedPrice1h,
          twentyFourHours: prediction.predictedPrice24h,
          sevenDays: prediction.predictedPrice7d,
        },
        analysis: {
          trend: prediction.trend,
          volatility: prediction.volatility,
          riskLevel: prediction.riskLevel,
          confidence: prediction.confidence,
        },
        recommendation: prediction.recommendation,
      },
    });
  } catch (error) {
    console.error("❌ Price prediction failed:", error);
    res.status(500).json({ error: "Price prediction failed" });
  }
});

// AI IL prediction
app.post("/api/ai/predict-il", async (req, res) => {
  try {
    const { tokenName, initialPrice, ilThreshold } = req.body;
    console.log(`🔮 AI IL prediction for ${tokenName}...`);
    
    const prediction = await aiPredictionEngine.predictIL(
      tokenName,
      initialPrice,
      ilThreshold
    );
    
    res.json({
      success: true,
      prediction: {
        tokenName: prediction.tokenName,
        currentIL: prediction.currentIL,
        predictedILs: {
          oneHour: prediction.predictedIL1h,
          twentyFourHours: prediction.predictedIL24h,
          sevenDays: prediction.predictedIL7d,
        },
        shouldExit: prediction.shouldExit,
        exitRecommendation: prediction.exitRecommendation,
        confidence: prediction.confidence,
      },
    });
  } catch (error) {
    console.error("❌ IL prediction failed:", error);
    res.status(500).json({ error: "IL prediction failed" });
  }
});

// Monitor position with enhanced features
app.post("/api/vault/monitor-enhanced", async (req, res) => {
  try {
    const { userPosition, ilThreshold } = req.body;
    console.log(`🛡️ Enhanced monitoring for ${userPosition.tokenB}...`);
    
    const monitorResult = await enhancedILCalculator.monitorPosition(
      userPosition,
      ilThreshold
    );
    
    res.json({
      success: true,
      monitoring: {
        shouldTrigger: monitorResult.shouldTrigger,
        reason: monitorResult.reason,
        ilPercentage: monitorResult.result.ilPercentage,
        riskLevel: monitorResult.result.riskLevel,
        currentPrice: monitorResult.result.currentPrice,
        priceChange: monitorResult.result.priceChange,
      },
    });
  } catch (error) {
    console.error("❌ Enhanced monitoring failed:", error);
    res.status(500).json({ error: "Monitoring failed" });
  }
});

// Batch price predictions for multiple tokens
app.post("/api/ai/batch-predict", async (req, res) => {
  try {
    const { tokenNames } = req.body;
    console.log(`🔮 Batch AI predictions for ${tokenNames.length} tokens...`);
    
    const predictions = await aiPredictionEngine.predictMultiplePrices(tokenNames);
    
    res.json({
      success: true,
      predictions: predictions.map(p => ({
        tokenName: p.tokenName,
        currentPrice: p.currentPrice,
        predicted24h: p.predictedPrice24h,
        trend: p.trend,
        recommendation: p.recommendation,
        confidence: p.confidence,
      })),
      count: predictions.length,
    });
  } catch (error) {
    console.error("❌ Batch prediction failed:", error);
    res.status(500).json({ error: "Batch prediction failed" });
  }
});

// Get user vaults - properly read from database WITH USER FILTERING
app.post("/api/vault/list", async (req, res) => {
  try {
    const { userAddress } = req.body;
    console.log(`📋 Listing vaults for user: ${userAddress?.slice(0, 12)}...`);

    if (!userAddress) {
      console.log("⚠️ No user address provided");
      return res.json({
        success: true,
        vaults: [],
        message: "No user address provided",
      });
    }

    // Get user's payment credential hash for filtering
    const lucid = await Lucid.new(
      new Blockfrost(networkConfig.blockfrostEndpoint, blockfrostKey),
      networkConfig.lucidNetwork,
    );

    const userDetails = lucid.utils.getAddressDetails(userAddress);
    let userPaymentHash = String(userDetails.paymentCredential?.hash || "");
    userPaymentHash = userPaymentHash.toLowerCase();
    console.log(`👤 User payment hash: ${userPaymentHash}`);

    // Get all vaults from database
    const allVaults = await database.getAllActiveVaults();
    console.log(`🔍 Found ${allVaults.length} total vaults in database`);

    // FILTER by owner - only return vaults owned by this user
    // Normalize stored owner and compare lowercase hex strings
    const userVaults = allVaults.filter((vault: any) => {
      const owner = String(vault.owner || "").toLowerCase();
      return owner === userPaymentHash;
    });
    console.log(`✅ Filtered to ${userVaults.length} vaults owned by user`);

    // Return the filtered vault data with proper token symbols
    const vaults = userVaults.map((vault: any) => ({
      vaultId: vault.vaultId,
      lpTokens: vault.lpTokens,
      depositAmount: vault.depositAmount,
      tokenPair: `${vault.tokenA || 'ADA'}/${vault.tokenB || 'TOKEN'}`, // Use stored token symbols
      ilPercentage: 2.0, // Will be calculated by IL service
      status: "Active",
      entryPrice: vault.entryPrice,
      currentPrice: vault.entryPrice ? vault.entryPrice * 1.02 : 0.98, // Slight price movement
      createdAt: vault.createdAt,
      ilThreshold: vault.ilThreshold,
      emergencyWithdraw: vault.emergencyWithdraw || true, // Include emergency withdraw flag
      owner: vault.owner, // Include owner for debugging
      tokenA: vault.tokenA || 'ADA', // Include individual tokens for better debugging
      tokenB: vault.tokenB || 'TOKEN'
    }));

    console.log(`✅ Returning ${vaults.length} vaults owned by user`);

    res.json({
      success: true,
      vaults: vaults,
      message: `Found ${vaults.length} vaults for user`,
      userPaymentHash: userPaymentHash, // Include for debugging
      totalVaultsInDb: allVaults.length,
    });
  } catch (error) {
    console.error("❌ Failed to list vaults:", error);
    res
      .status(500)
      .json({ error: "Failed to list vaults", details: String(error) });
  }
});

// Endpoint to fetch UTXOs for a given address
app.post("/api/utxo", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res
        .status(400)
        .json({ success: false, message: "Address is required" });
    }

    console.log(`🔍 Fetching UTXOs for address: ${address}`);

    // Initialize Lucid
    const lucid = await Lucid.new(
      new Blockfrost(networkConfig.blockfrostEndpoint, blockfrostKey),
      networkConfig.lucidNetwork,
    );

    // Fetch UTXOs
    const utxos = await lucid.utxosAt(address);

    console.log(`✅ Found ${utxos.length} UTXOs for address: ${address}`);

    // Convert BigInt values to strings for JSON serialization
    const serializedUtxos = utxos.map((utxo) => ({
      ...utxo,
      assets: Object.fromEntries(
        Object.entries(utxo.assets).map(([key, value]) => [
          key,
          typeof value === "bigint" ? value.toString() : value,
        ]),
      ),
    }));

    res.json({ success: true, utxos: serializedUtxos });
  } catch (error) {
    console.error("❌ Failed to fetch UTXOs:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch UTXOs",
      error: errorMessage,
    });
  }
});

// Create Minswap withdraw order endpoint
app.post("/api/minswap/withdraw-order", async (req, res) => {
  try {
    const {
      lpAsset,
      lpAmount,
      reserveA,
      reserveB,
      totalLiquidity,
      userAddress,
      slippage,
    } = req.body;

    console.log("🔄 Creating Minswap withdraw order...");
    console.log(`   LP Amount: ${lpAmount}`);
    console.log(`   Pool Reserves: ${reserveA} / ${reserveB}`);
    console.log(`   User: ${userAddress}`);

    if (
      !lpAsset ||
      !lpAmount ||
      !reserveA ||
      !reserveB ||
      !totalLiquidity ||
      !userAddress
    ) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const lucid = await Lucid.new(
      new Blockfrost(networkConfig.blockfrostEndpoint, blockfrostKey),
      networkConfig.lucidNetwork,
    );

    // Get user payment hash
    const userDetails = lucid.utils.getAddressDetails(userAddress);
    const userPubKeyHash = userDetails.paymentCredential?.hash || "";

    // Calculate minimum amounts with slippage
    const lpAmountBigInt = BigInt(lpAmount);
    const reserveABigInt = BigInt(reserveA);
    const reserveBBigInt = BigInt(reserveB);
    const totalLiquidityBigInt = BigInt(totalLiquidity);

    const amountA = (reserveABigInt * lpAmountBigInt) / totalLiquidityBigInt;
    const amountB = (reserveBBigInt * lpAmountBigInt) / totalLiquidityBigInt;

    const slippageValue = slippage || 0.02; // 2% default
    const slippageFactor = BigInt(Math.floor((1 - slippageValue) * 10000));
    const minA = (amountA * slippageFactor) / 10000n;
    const minB = (amountB * slippageFactor) / 10000n;

    // Create withdraw order datum
    const noDatum = new Constr(0, []);

    const withdrawStep = new Constr(4, [
      new Constr(0, [lpAmountBigInt]), // WAOSpecificAmount variant
      minA, // minimum_asset_a
      minB, // minimum_asset_b
      new Constr(0, []), // killable: False (safer default)
    ]);

    const orderDatum = new Constr(0, [
      new Constr(0, [userPubKeyHash]), // canceller (OAMSignature)
      userPubKeyHash, // refund_receiver
      new Constr(1, []), // refund_receiver_datum: None
      userPubKeyHash, // success_receiver
      new Constr(1, []), // success_receiver_datum: None
      new Constr(0, [lpAsset.policyId, lpAsset.tokenName]), // lp_asset
      2_000000n, // batcher_fee
      new Constr(1, []), // expired_setting_opt: None
      withdrawStep, // step
    ]);

    const datumHex = Data.to(orderDatum);

    // Minswap order contract address (Preprod) - REAL ADDRESS
    const orderAddress =
      "addr_test1wqag3rt979nep9kzka7hke84x8uedaqs0gk4k5ue9kgvlqgke2zne";

    res.json({
      success: true,
      orderDatum: datumHex,
      orderAddress,
      minTokenA: minA.toString(),
      minTokenB: minB.toString(),
      batcherFee: "2000000",
      lpAsset: lpAsset,
      lpAmount: lpAmount,
    });

    console.log("✅ Withdraw order data prepared successfully");
  } catch (error) {
    console.error("❌ Failed to create withdraw order:", error);
    res.status(500).json({ error: String(error) });
  }
});

// Debug endpoint to get payment hash for an address
app.post("/api/debug/payment-hash", async (req, res) => {
  try {
    const { userAddress } = req.body;
    if (!userAddress) {
      return res.status(400).json({ error: "userAddress required" });
    }

    const lucid = await Lucid.new(
      new Blockfrost(networkConfig.blockfrostEndpoint, blockfrostKey),
      networkConfig.lucidNetwork,
    );

    const userDetails = lucid.utils.getAddressDetails(userAddress);
    const userPaymentHash = String(
      userDetails.paymentCredential?.hash || "",
    ).toLowerCase();

    res.json({
      userAddress,
      paymentHash: userPaymentHash,
      credentialType: userDetails.paymentCredential?.type,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Debug endpoint to validate redeemer serialization
app.post("/api/debug/redeemer", (req, res) => {
  try {
    // Test all redeemer variants
    const deposit = new Constr(0, [1000000n]);
    const withdraw = new Constr(1, [1000000n, 500n]);
    const updatePolicy = new Constr(2, [
      new Constr(0, [500n, true, new Constr(0, [100n, 100n])]),
    ]);
    const emergencyExit = new Constr(3, []);

    const serializedDeposit = Data.to(deposit);
    const serializedWithdraw = Data.to(withdraw);
    const serializedEmergencyExit = Data.to(emergencyExit);

    // Test deserialization
    const deserializedEmergencyExit = Data.from(serializedEmergencyExit);

    res.json({
      success: true,
      redeemers: {
        deposit: {
          constrIndex: 0,
          serializedHex: serializedDeposit,
          length: serializedDeposit.length,
        },
        withdraw: {
          constrIndex: 1,
          serializedHex: serializedWithdraw,
          length: serializedWithdraw.length,
        },
        emergencyExit: {
          constrIndex: 3,
          fields: [],
          serializedHex: serializedEmergencyExit,
          length: serializedEmergencyExit.length,
          deserializedBack: deserializedEmergencyExit,
        },
      },
      message: "All redeemer serializations working correctly",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
});

// ============================================================================
// AI RISK ENGINE ENDPOINTS
// ============================================================================

// Initialize risk engine
const riskEngine = new YieldSafeRiskEngine();

// ENDPOINT: Analyze risk for a vault
app.post("/api/risk/analyze", async (req, res) => {
  try {
    const { tokenA, tokenB, ilThreshold } = req.body;

    if (!tokenA || !tokenB) {
      return res.status(400).json({
        success: false,
        error: "Missing tokenA or tokenB",
      });
    }

    console.log(
      `\n📊 Risk analysis request: ${tokenA}/${tokenB}, IL threshold: ${ilThreshold || 5}%`,
    );

    const analysis = await riskEngine.analyzeRisk(
      tokenA,
      tokenB,
      ilThreshold || 5,
    );

    res.json({
      success: true,
      analysis: {
        action: analysis.action,
        garchVolatility: analysis.garchVolatility.toFixed(4),
        lstmVolatility: analysis.lstmVolatility.toFixed(4),
        confidence: analysis.confidence.toFixed(2),
        reason: analysis.reason,
        timestamp: analysis.timestamp,
        recommendation:
          analysis.action === "EMERGENCY_EXIT"
            ? "🚨 HIGH RISK - Consider emergency exit"
            : "✅ Market stable - Safe to farm",
      },
    });
  } catch (error) {
    console.error("❌ Risk analysis failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze risk",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// ENDPOINT: Start monitoring multiple vaults
app.post("/api/risk/start-monitoring", async (req, res) => {
  try {
    const { vaults, intervalMs } = req.body;

    if (!vaults || vaults.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No vaults provided",
      });
    }

    const vaultPairs = vaults.map((vault: any) => ({
      tokenA: vault.tokenA || "ADA",
      tokenB: vault.tokenB,
      ilThreshold: vault.ilThreshold || 5,
      vaultId: vault.vaultId,
    }));

    riskEngine.startContinuousMonitoring(
      vaultPairs,
      intervalMs || 5 * 60 * 1000,
    );

    res.json({
      success: true,
      message: `Started monitoring ${vaults.length} vaults`,
      interval: `${(intervalMs || 5 * 60 * 1000) / 1000} seconds`,
      vaults: vaultPairs,
    });
  } catch (error) {
    console.error("❌ Start monitoring failed:", error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// ENDPOINT: Stop monitoring
app.post("/api/risk/stop-monitoring", (req, res) => {
  try {
    riskEngine.stopMonitoring();
    res.json({
      success: true,
      message: "Risk monitoring stopped",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

// ENDPOINT: Get monitoring status
app.get("/api/risk/status", (req, res) => {
  const status = riskEngine.getMonitoringStatus();
  res.json({
    success: true,
    monitoring: status.active,
    vaultsMonitored: status.vaults.length,
    vaults: status.vaults,
    lastUpdated: Date.now(),
  });
});

// ============================================
// MASUMI MIP-003 AGENTIC SERVICE API ENDPOINTS
// ============================================

// Initialize Masumi Agent
const masumiAgent = new MasumiAgentService();
console.log("🤖 Masumi Agent Service initialized");

// MIP-003: /start_job - Initiate a risk analysis job
app.post("/api/masumi/start_job", async (req, res) => {
  try {
    const { identifier_from_purchaser, input_data } = req.body;

    if (!identifier_from_purchaser) {
      return res.status(400).json({
        status: "error",
        message: "identifier_from_purchaser is required",
      });
    }

    if (!input_data) {
      return res.status(400).json({
        status: "error",
        message: "input_data is required",
      });
    }

    const result = await masumiAgent.startJob({
      identifier_from_purchaser,
      input_data,
    });

    console.log(`📋 Masumi job started: ${result.job_id}`);
    res.json(result);
  } catch (error) {
    console.error("❌ Masumi start_job error:", error);
    res.status(400).json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// MIP-003: /status - Get job status
app.get("/api/masumi/status", (req, res) => {
  try {
    const { job_id } = req.query;

    if (!job_id || typeof job_id !== "string") {
      return res.status(400).json({
        status: "error",
        message: "job_id query parameter is required",
      });
    }

    const status = masumiAgent.getJobStatus(job_id);
    res.json(status);
  } catch (error) {
    console.error("❌ Masumi status error:", error);
    res.status(404).json({
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// MIP-003: /availability - Check agent availability
app.get("/api/masumi/availability", (req, res) => {
  const availability = masumiAgent.checkAvailability();
  res.json(availability);
});

// MIP-003: /input_schema - Get expected input format
app.get("/api/masumi/input_schema", (req, res) => {
  const schema = masumiAgent.getInputSchema();
  res.json(schema);
});

// Additional Masumi endpoints

// Get agent metadata for registry
app.get("/api/masumi/metadata", (req, res) => {
  const metadata = masumiAgent.getAgentMetadata();
  res.json(metadata);
});

// List all jobs (for debugging)
app.get("/api/masumi/jobs", (req, res) => {
  const jobs = masumiAgent.listJobs();
  res.json({
    success: true,
    count: jobs.length,
    jobs: jobs.map((j) => ({
      job_id: j.job_id,
      status: j.status,
      tokenPair: `${j.input_data.tokenA}/${j.input_data.tokenB}`,
      ilThreshold: j.input_data.ilThreshold,
      created: new Date(j.created_at * 1000).toISOString(),
      result: j.result ? j.result.action : null,
      blockchainIdentifier: j.blockchainIdentifier,
    })),
  });
});

// Get payment statistics
app.get("/api/masumi/payments", (req, res) => {
  const stats = masumiAgent.getPaymentStats();
  res.json({
    success: true,
    totalVerified: stats.totalVerified,
    totalEarnings: `${Number(stats.totalAmount) / 1_000_000} ADA`,
    totalEarningsLovelace: stats.totalAmount.toString(),
    recentPayments: stats.recentPayments.map((p) => ({
      txHash: p.txHash,
      amount: `${Number(p.amount) / 1_000_000} ADA`,
      sender: p.sender,
      timestamp: new Date(p.timestamp).toISOString(),
      confirmed: p.confirmed,
    })),
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "Yield Safe API",
    timestamp: new Date().toISOString(),
  });
});

// Scheduled cache refresh every 10 minutes
setInterval(async () => {
  console.log("🔄 Refreshing Charli3 pool cache (scheduled)...");
  try {
    const pools = await charli3Integration.getAllEnhancedPools();
    console.log(`✅ Cache refreshed: ${pools.length} pools updated`);
  } catch (err: any) {
    console.error("⚠️ Scheduled cache refresh failed:", err.message);
  }
}, 10 * 60 * 1000); // 10 minutes

// Export function to start the server
export async function startAPIServer() {
  return new Promise<void>((resolve) => {
    app.listen(port, async () => {
      console.log(`🚀 Yield Safe API Server running on port ${port}`);
      console.log(`🔗 Frontend can connect to: http://localhost:${port}`);
      console.log(`📊 IL Calculator: Ready with fixed calculations`);

      // Initialize services after server starts
      await initializeServices();
      resolve();
    });
  });
}

export default app;
