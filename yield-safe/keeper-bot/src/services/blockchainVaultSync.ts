import { Lucid, Data } from "lucid-cardano";
import { DatabaseService } from "../database/database.js";
import { logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";

interface VaultData {
  vaultId: string;
  owner: string;
  poolId: string;
  tokenA: string;
  tokenB: string;
  tokenAPolicyId: string;
  tokenBPolicyId: string;
  depositAmount: number;
  tokenBAmount: number;
  lpTokens: number;
  entryPrice: number;
  ilThreshold: number;
  createdAt: number;
  status: "active" | "protected" | "withdrawn";
  emergencyWithdraw: boolean;
}

export class BlockchainVaultSync {
  private lucid: Lucid;
  private database: DatabaseService;
  private vaultAddress: string;
  private maxRetries: number = 3;
  private retryDelayMs: number = 2000; // Start with 2 seconds

  constructor(lucid: Lucid, database: DatabaseService) {
    this.lucid = lucid;
    this.database = database;
    this.vaultAddress = "";
  }

  // Retry logic with exponential backoff
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.debug(
          `   Attempt ${attempt}/${this.maxRetries} for ${operationName}...`,
        );
        return await fn();
      } catch (error) {
        lastError = error as Error;
        const isConnectError =
          lastError.message.includes("CONNECT_TIMEOUT") ||
          lastError.message.includes("fetch failed") ||
          lastError.message.includes("socket hang up");

        if (!isConnectError || attempt === this.maxRetries) {
          throw error;
        }

        const delayMs = this.retryDelayMs * Math.pow(2, attempt - 1);
        logger.warn(
          `   ⚠️  ${operationName} attempt ${attempt} failed, retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError || new Error(`${operationName} failed after ${this.maxRetries} attempts`);
  }

  // Load vault validator and get address
  private async getVaultAddress(): Promise<string> {
    if (this.vaultAddress) return this.vaultAddress;

    try {
      const plutusPath = path.resolve(
        process.cwd(),
        "../contracts/plutus.json",
      );
      const plutusFile = fs.readFileSync(plutusPath, "utf-8");
      const plutusCompiled = JSON.parse(plutusFile);

      const vaultValidator = plutusCompiled.validators.find(
        (v: any) => v.title === "vault.vault_validator",
      );

      if (!vaultValidator) {
        throw new Error("Vault validator not found in plutus.json");
      }

      const validator = {
        type: "PlutusV2" as const,
        script: vaultValidator.compiledCode,
      };

      this.vaultAddress = this.lucid.utils.validatorToAddress(validator);
      logger.info(`🏦 Vault contract address: ${this.vaultAddress}`);
      return this.vaultAddress;
    } catch (error) {
      logger.error("❌ Failed to load vault address:", error);
      throw error;
    }
  }

  // Helper to convert hex to string
  private hexToString(hex: string): string {
    if (!hex) return "ADA";
    try {
      return Buffer.from(hex, "hex").toString("utf8");
    } catch {
      return hex.slice(0, 8);
    }
  }

  // Helper to map known policy IDs to token symbols (comprehensive token mapping)
  private mapPolicyToSymbol(policyId: string): string {
    const knownTokens: Record<string, string> = {
      // Major tokens from apiServer.ts tokenPolicyMap
      "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61": "DJED",
      "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f": "SNEK",
      "e4214b7cce62ac6fbba385d164df48e157eae5863521b4b67ca71d86": "MIN",
      "25c5de5f5b286073c593edfd77b48abc7a48e5a4f3d4cd9d428ff9355": "USDC",
      "d894897411707efa755a76deb66d26dfd50593f2e70863e1661e98a0": "SPACE",
      "f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc53541474958": "AGIX",
      "533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0": "HUNT",
      "f6f49b186751e61f1fb8c64e7504e771f968cea9f4d11f5222b169e374756e65": "IAGON", 
      "3a888d65f16790950a72daee1f63aa05add6d268434107cfa5b67712": "iUSD",
      "5dac8536653edc12f6f5e1045d8164b9f59998d3bdc300fc92843489544e": "IBTC",
      "5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114": "NTX",
      "25f0fc240e91bd95dcdaebd2ba7713fc5168ac77234a3d79449fc20c4f4f5054494d": "OPTIM",
      "1d7f33bd23d85e1a25d87d86fac4f199c3197a2f7afeb662a0f34e1e776f726c64636f696e": "WRT",
      "86df1c0b1bfaeef86e67d42eb7ffb69bab4c8ad19bcadf9f8b52bb6e434e544c": "CNTL",
      "af2e27f580f7f08e93190a81f72462f153026d06450924726645891b": "DJED",
      "6ac8ef33b510ec004fe11585f7c5a9f0c07f0c23428ab4f29c1d7d104d494e": "MIN",
      "dda5fdb1002f7389b33e036b6afee82a8189becb6cba852e8b79b4fb0014df44524950": "DRIPN",
      "9a9693a9a37912a5097918f97918d15240c92ab729a0b7c4aa144d77": "SUNDAE",
      "6c8642400a9f4c1e3d5f6f84e8d6e1c2a9b35f4321a34567890123456789abcd": "C3"
    };
    
    logger.debug(`   🔍 Looking up policy ID: ${policyId}`);
    const symbol = knownTokens[policyId];
    if (symbol) {
      logger.debug(`   ✅ Found token symbol: ${symbol}`);
      return symbol;
    } else {
      logger.debug(`   ⚠️  Unknown policy ID, using fallback: TOKEN`);
      return "TOKEN";
    }
  }

  // Decode vault datum
  private decodeVaultDatum(datum: string, utxo: any): VaultData | null {
    try {
      // Decode the actual on-chain structure: Constr(0, [...]) with 6 nested fields
      // VaultDatum { owner, policy, lp_asset, deposit_amount, deposit_time, initial_pool_state }
      const decodedDatum = Data.from(datum) as any;

      // Validate it's a Constr with expected number of fields (6)
      if (!decodedDatum.fields || decodedDatum.fields.length < 6) {
        throw new Error(
          `Expected Constr with 6 fields, got ${decodedDatum.fields?.length || 0}`,
        );
      }

      // Helper to safely convert to hex string
      const toHexString = (data: any): string => {
        if (!data) return "";
        if (typeof data === "string") return data;
        try {
          return Buffer.from(data).toString("hex");
        } catch {
          return "";
        }
      };

      // Extract fields from Constr(0, [...]) structure (6 nested fields):
      // [0] owner: ByteArray
      const ownerHash = decodedDatum.fields[0];
      const ownerHex = toHexString(ownerHash);

      // [1] policy: UserPolicy { max_il_percent, deposit_ratio, emergency_withdraw }
      const policyFields = decodedDatum.fields[1]?.fields || [];
      const ilThresholdBasisPoints = Number(policyFields[0] || 500); // max_il_percent
      const ilThreshold = ilThresholdBasisPoints / 100; // Convert to percentage

      // deposit_ratio is nested: AssetRatio { asset_a_amount, asset_b_amount }
      const depositRatioFields = policyFields[1]?.fields || [];
      const assetAAmount = Number(depositRatioFields[0] || 0); // in lovelace
      const assetBAmount = Number(depositRatioFields[1] || 0);

      const emergencyWithdraw = Boolean(policyFields[2]);

      // [2] lp_asset: Asset { policy_id, token_name }
      const lpAssetFields = decodedDatum.fields[2]?.fields || ["", ""];
      const lpPolicyId = toHexString(lpAssetFields[0]) || "";
      const lpTokenNameHex = lpAssetFields[1] || "";
      const lpTokenName = this.hexToString(toHexString(lpTokenNameHex)) || "LP";

      // [3] deposit_amount: Int (LP tokens in micro units)
      const lpTokens = Number(decodedDatum.fields[3]) / 1_000_000;

      // [4] deposit_time: Int (POSIX timestamp)
      const depositTime = Number(decodedDatum.fields[4]);

      // [5] initial_pool_state: PoolState { reserve_a, reserve_b, total_lp_tokens, last_update_time }
      const poolStateFields = decodedDatum.fields[5]?.fields || [];
      const initialReserveA = Number(poolStateFields[0] || 0);
      const initialReserveB = Number(poolStateFields[1] || 0);

      // Calculate entry price from initial pool state
      const entryPrice =
        initialReserveB > 0 ? initialReserveA / initialReserveB / 1_000_000 : 0;

      // Determine token symbols with enhanced resolution logic
      const tokenASymbol = "ADA";
      let tokenBSymbol = "Loading..."; // Start with loading state
      
      logger.debug(`   🔍 Resolving token B symbol from LP policy: ${lpPolicyId}`);
      
      // Priority 1: Try to map from known policy IDs (most reliable)
      if (lpPolicyId) {
        const mappedSymbol = this.mapPolicyToSymbol(lpPolicyId);
        if (mappedSymbol !== "TOKEN") {
          tokenBSymbol = mappedSymbol;
          logger.debug(`   ✅ Token B resolved from policy mapping: ${tokenBSymbol}`);
        }
      }
      
      // Priority 2: Try LP token name if available and not generic
      if (tokenBSymbol === "Loading..." && lpTokenName && lpTokenName !== "LP" && lpTokenName.length < 10) {
        tokenBSymbol = lpTokenName.toUpperCase();
        logger.debug(`   ✅ Token B resolved from LP name: ${tokenBSymbol}`);
      }
      
      // Priority 3: Try to decode from hex token name
      if (tokenBSymbol === "Loading..." && lpTokenNameHex) {
        const decodedName = this.hexToString(toHexString(lpTokenNameHex));
        if (decodedName && decodedName !== "LP" && decodedName.length > 1 && decodedName.length < 10) {
          tokenBSymbol = decodedName.toUpperCase();
          logger.debug(`   ✅ Token B resolved from hex decode: ${tokenBSymbol}`);
        }
      }
      
      // Fallback: Use a generic token identifier
      if (tokenBSymbol === "Loading...") {
        tokenBSymbol = "TOKEN";
        logger.warn(`   ⚠️  Could not resolve token B symbol, using fallback: ${tokenBSymbol}`);
      }

      const vaultData: VaultData = {
        vaultId: `${utxo.txHash}#${utxo.outputIndex}`,
        owner: ownerHex,
        poolId: lpPolicyId || "minswap",
        tokenA: tokenASymbol,
        tokenB: tokenBSymbol,
        tokenAPolicyId: "",
        tokenBPolicyId: lpPolicyId,
        depositAmount: assetAAmount / 1_000_000, // Convert lovelace to ADA
        tokenBAmount: assetBAmount / 1_000_000,
        lpTokens: lpTokens,
        entryPrice: entryPrice,
        ilThreshold: ilThreshold,
        createdAt: depositTime * 1000,
        status: "active",
        emergencyWithdraw: emergencyWithdraw,
      };

      logger.info(
        `   📦 Decoded vault: ${vaultData.tokenA}/${vaultData.tokenB} @ ${entryPrice.toFixed(6)} (owner: ${ownerHex.slice(0, 12)}...)`,
      );
      logger.info(
        `   💰 Deposit: ${vaultData.depositAmount.toFixed(2)} ADA + ${vaultData.tokenBAmount.toFixed(2)} ${tokenBSymbol}, LP: ${lpTokens.toFixed(2)}, IL Threshold: ${ilThreshold}%`,
      );

      return vaultData;
    } catch (error) {
      logger.error("   ❌ Failed to decode vault datum:", error);
      return null;
    }
  }

  // Sync all vaults from blockchain to database
  async syncVaultsFromBlockchain(): Promise<number> {
    try {
      logger.info("🔄 Syncing vaults from blockchain...");

      const vaultAddress = await this.getVaultAddress();

      // Get all UTxOs at vault contract address with retry logic
      const vaultUtxos = await this.retryWithBackoff(
        () => this.lucid.utxosAt(vaultAddress),
        "Fetch vault UTxOs",
      );
      logger.info(`   Found ${vaultUtxos.length} UTxOs at vault address`);

      let syncedCount = 0;

      for (const utxo of vaultUtxos) {
        if (!utxo.datum) {
          logger.debug(
            `   ⏭️  Skipping UTxO without datum: ${utxo.txHash}#${utxo.outputIndex}`,
          );
          continue;
        }

        const vaultId = `${utxo.txHash}#${utxo.outputIndex}`;

        // Check if vault already exists in database
        const existingVault = await this.database.getVault(vaultId);
        if (existingVault) {
          logger.debug(`   ⏭️  Vault already in database: ${vaultId}`);
          continue;
        }

        // Decode and store new vault
        logger.info(`\n📦 Processing new vault: ${vaultId}`);
        const vaultData = this.decodeVaultDatum(utxo.datum, utxo);

        if (vaultData) {
          // Store vault in database
          await this.database.storeVault(vaultData);
          logger.info(
            `   ✅ Vault synced to database: ${vaultData.tokenA}/${vaultData.tokenB}`,
          );
          syncedCount++;
        }
      }

      logger.info(
        `\n✅ Blockchain sync complete: ${syncedCount} new vaults synced`,
      );
      return syncedCount;
    } catch (error) {
      logger.error("❌ Blockchain vault sync failed:", error);
      throw error;
    }
  }

  // Periodic sync - run every 5 minutes
  async startPeriodicSync(intervalMinutes: number = 5): Promise<void> {
    logger.info(
      `⏰ Starting periodic vault sync every ${intervalMinutes} minutes`,
    );

    // Initial sync
    await this.syncVaultsFromBlockchain();

    // Schedule periodic sync
    setInterval(
      async () => {
        try {
          await this.syncVaultsFromBlockchain();
        } catch (error) {
          logger.error("❌ Periodic sync failed:", error);
        }
      },
      intervalMinutes * 60 * 1000,
    );
  }

  // Remove vaults that no longer exist on-chain
  async pruneClosedVaults(): Promise<void> {
    try {
      logger.info("🧹 Checking for closed vaults...");

      const vaultAddress = await this.getVaultAddress();
      const vaultUtxos = await this.lucid.utxosAt(vaultAddress);
      const onChainVaultIds = new Set(
        vaultUtxos.map((utxo) => `${utxo.txHash}#${utxo.outputIndex}`),
      );

      // Get all vaults from database
      const dbVaults = await this.database.getAllActiveVaults();

      for (const vault of dbVaults) {
        if (!onChainVaultIds.has(vault.vaultId)) {
          logger.info(`   🔒 Marking vault as withdrawn: ${vault.vaultId}`);
          await this.database.updateVaultStatus(vault.vaultId, "withdrawn");
        }
      }

      logger.info("✅ Vault pruning complete");
    } catch (error) {
      logger.error("❌ Vault pruning failed:", error);
    }
  }
}
