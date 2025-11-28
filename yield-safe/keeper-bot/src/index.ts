import { Lucid, Blockfrost } from "lucid-cardano";
import { KeeperBot } from "./keeper/keeper-bot.js";
import { DatabaseService } from "./database/database.js";
import { PoolMonitor } from "./monitoring/pool-monitor.js";
import { ILCalculator } from "./calculations/il-calculator.js";
import { BlockchainVaultSync } from "./services/blockchainVaultSync.js";
import { logger } from "./utils/logger.js";
import { loadConfig } from "./utils/config.js";
import cron from "node-cron";

async function main() {
  try {
    logger.info("🚀 Starting Yield Safe Keeper Bot...");
    
    // Load configuration
    const config = await loadConfig();
    
    // Initialize Lucid with Blockfrost
    const lucid = await Lucid.new(
      new Blockfrost(config.blockfrost.url, config.blockfrost.apiKey),
      config.network
    );
    
    // Set wallet from private key (skip for demo mode)
    if (config.keeper.privateKey && config.keeper.privateKey !== "demo_mode") {
      lucid.selectWalletFromPrivateKey(config.keeper.privateKey);
      logger.info("🔑 Wallet configured from private key");
    } else {
      logger.info("🔑 Running in demo mode - no wallet configured");
    }
    
    // Initialize services
    const database = new DatabaseService(config.database.path);
    await database.initialize();
    
    const poolMonitor = new PoolMonitor(lucid, database);
    const ilCalculator = new ILCalculator();
    const blockchainSync = new BlockchainVaultSync(lucid, database);
    const keeperBot = new KeeperBot(lucid, database, poolMonitor, ilCalculator, config);
    
    // Sync vaults from blockchain first
    logger.info("🔄 Syncing real vaults from blockchain...");
    await blockchainSync.syncVaultsFromBlockchain();
    
    // Start periodic vault sync every 5 minutes
    await blockchainSync.startPeriodicSync(5);
    
    // Start monitoring pools for price changes
    logger.info("📊 Starting pool monitoring...");
    await poolMonitor.startMonitoring();
    
    // Schedule keeper bot operations
    logger.info("⏰ Scheduling keeper operations...");
    
    // Check for IL violations every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      logger.info("🔍 Running IL violation check...");
      await keeperBot.checkILViolations();
    });
    
    // Update pool prices every minute
    cron.schedule("* * * * *", async () => {
      logger.debug("📈 Updating pool prices...");
      await poolMonitor.updateAllPoolPrices();
    });
    
    // Perform database cleanup every hour
    cron.schedule("0 * * * *", async () => {
      logger.info("🧹 Cleaning up old data...");
      await database.cleanup();
      await blockchainSync.pruneClosedVaults();
    });
    
    // Health check every 10 minutes
    cron.schedule("*/10 * * * *", async () => {
      await keeperBot.healthCheck();
    });
    
    logger.info("✅ Yield Safe Keeper Bot is running!");
    
    // Keep the process running
    process.on('SIGINT', async () => {
      logger.info("🛑 Shutting down Yield Safe Keeper Bot...");
      await poolMonitor.stopMonitoring();
      await database.close();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error("❌ Failed to start Yield Safe Keeper Bot:");
    console.error(error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error("💥 Uncaught exception:", error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error("🚨 Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  logger.error("💀 Application failed to start:", error);
  process.exit(1);
});