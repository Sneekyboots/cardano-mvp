#!/usr/bin/env npx tsx
// Test script to manually trigger IL violation check
import { Lucid, Blockfrost } from "lucid-cardano";
import { KeeperBot } from "./keeper/keeper-bot.js";
import { DatabaseService } from "./database/database.js";
import { PoolMonitor } from "./monitoring/pool-monitor.js";
import { ILCalculator } from "./calculations/il-calculator.js";
import { BlockchainVaultSync } from "./services/blockchainVaultSync.js";
import { loadConfig } from "./utils/config.js";

async function testILCheck() {
  try {
    console.log("🚀 Manual IL Violation Check Test");
    console.log("═══════════════════════════════════");
    
    // Load configuration
    const config = await loadConfig();
    
    // Initialize Lucid with Blockfrost
    const lucid = await Lucid.new(
      new Blockfrost(config.blockfrost.url, config.blockfrost.apiKey),
      config.network
    );
    
    // Initialize services
    const database = new DatabaseService(config.database.path);
    await database.initialize();
    
    const poolMonitor = new PoolMonitor(lucid, database);
    const ilCalculator = new ILCalculator();
    const blockchainSync = new BlockchainVaultSync(lucid, database);
    const keeperBot = new KeeperBot(lucid, database, poolMonitor, ilCalculator, config);
    
    // Sync vaults from blockchain first
    console.log("🔄 Syncing vaults from blockchain...");
    await blockchainSync.syncVaultsFromBlockchain();
    
    // Trigger IL violation check manually
    console.log("\n🔍 Running manual IL violation check...");
    await keeperBot.checkILViolations();
    
    console.log("\n✅ Manual IL check completed!");
    
    // Close database
    await database.close();
    
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testILCheck().catch(console.error);