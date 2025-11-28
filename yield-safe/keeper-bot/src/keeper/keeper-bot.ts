import { Lucid, Blockfrost } from "lucid-cardano";
import { DatabaseService } from "../database/database.js";
import { PoolMonitor } from "../monitoring/pool-monitor.js";
import { ILCalculator } from "../calculations/il-calculator.js";
import { RealILCalculator } from "../realILCalculator.js";
import { logger } from "../utils/logger.js";
import { KeeperConfig } from "../utils/config.js";

export class KeeperBot {
  private lucid: Lucid;
  private database: DatabaseService;
  private poolMonitor: PoolMonitor;
  private ilCalculator: ILCalculator;
  private realILCalculator: RealILCalculator;
  private config: KeeperConfig;
  private isRunning: boolean = false;

  constructor(
    lucid: Lucid,
    database: DatabaseService,
    poolMonitor: PoolMonitor,
    ilCalculator: ILCalculator,
    config: KeeperConfig
  ) {
    this.lucid = lucid;
    this.database = database;
    this.poolMonitor = poolMonitor;
    this.ilCalculator = ilCalculator;
    this.realILCalculator = new RealILCalculator(); // Add real IL calculator
    this.config = config;
  }

  async start() {
    logger.info("🤖 Starting Yield Safe Keeper Bot...");
    this.isRunning = true;
    
    // Start monitoring loop
    this.monitoringLoop();
  }

  async stop() {
    logger.info("🛑 Stopping Yield Safe Keeper Bot...");
    this.isRunning = false;
  }

  private async monitoringLoop() {
    while (this.isRunning) {
      try {
        await this.checkILViolations();
        await this.sleep(60000); // Check every minute
      } catch (error) {
        logger.error("Error in monitoring loop:", error);
        await this.sleep(10000); // Retry after 10 seconds on error
      }
    }
  }

  async checkILViolations() {
    logger.debug("🔍 Checking for IL violations...");
    
    try {
      // Get real vaults from database
      const vaults = await this.database.getAllVaults()
      
      if (vaults.length === 0) {
        logger.debug("📭 No vaults found in database")
        return
      }
      
      logger.info(`🔍 Monitoring ${vaults.length} real vault(s) for IL violations`)
      
      for (const vault of vaults) {
        try {
          // Skip if vault doesn't have emergency withdraw enabled
          if (!vault.emergencyWithdraw) {
            logger.debug(`⏭️  Skipping vault ${vault.vaultId} - emergency withdraw disabled`)
            continue
          }
          
          // Create user position from vault data
          const userPosition = {
            token_a_amount: vault.depositAmount,
            token_b_amount: vault.tokenBAmount || 0,
            lp_tokens: vault.lpTokens,
            initial_price: vault.entryPrice,
            deposit_timestamp: vault.createdAt
          }
          
          // Use RealILCalculator for accurate IL calculation
          const poolData = await this.realILCalculator.getPoolDataFromCharli3(
            vault.tokenA, 
            vault.tokenB
          )
          
          const ilData = await this.realILCalculator.calculateRealIL(userPosition, poolData)
          const currentIL = Math.abs(ilData.ilPercentage)
          const maxIL = vault.ilThreshold
          
          logger.debug(`📊 Vault ${vault.vaultId} (${vault.tokenA}/${vault.tokenB}): ${currentIL.toFixed(2)}% IL vs ${maxIL}% threshold`)
          
          if (currentIL > maxIL) {
            logger.warn(`🚨 IL Violation detected for vault ${vault.vaultId}`)
            logger.warn(`   Current IL: ${currentIL.toFixed(2)}% > Threshold: ${maxIL}%`)
            logger.warn(`   LP Value: $${ilData.lpValue.toFixed(2)}, Hold Value: $${ilData.holdValue.toFixed(2)}`)
            logger.warn(`   IL Loss: $${Math.abs(ilData.ilAmount).toFixed(2)}`)
            
            await this.executeProtection(vault, ilData)
          } else {
            logger.debug(`✅ Vault ${vault.vaultId} within limits: ${currentIL.toFixed(2)}% < ${maxIL}%`)
          }
          
        } catch (vaultError) {
          logger.error(`❌ Error processing vault ${vault.vaultId}:`, vaultError)
        }
      }
      
    } catch (error) {
      logger.error("❌ Failed to check IL violations:", error)
    }
  }

  private async executeProtection(vault: any, ilData: any) {
    logger.info(`🛡️ Executing protection for vault ${vault.vaultId}`)
    logger.info(`   Token Pair: ${vault.tokenA}/${vault.tokenB}`)
    logger.info(`   Current IL: ${Math.abs(ilData.ilPercentage).toFixed(2)}%`)
    logger.info(`   Threshold: ${vault.ilThreshold}%`)
    logger.info(`   LP Tokens: ${vault.lpTokens}`)
    
    // Check if we have wallet configured for actual transactions
    if (this.config.keeper.privateKey === "demo_mode") {
      logger.warn("🎭 Demo mode: Simulating protection transaction")
      await this.simulateTransaction(vault, ilData)
      return
    }
    
    try {
      // Calculate exit strategy - partial exit to bring IL back under threshold
      const targetIL = vault.ilThreshold * 0.8 // Target 80% of threshold for buffer
      const currentIL = Math.abs(ilData.ilPercentage)
      const exitPercentage = Math.min(50, ((currentIL - targetIL) / currentIL) * 100)
      const tokensToExit = Math.floor(vault.lpTokens * exitPercentage / 100)
      
      logger.info(`📊 Protection strategy: Exit ${exitPercentage.toFixed(1)}% (${tokensToExit} LP tokens)`)
      
      // For now, simulate the transaction until we have emergency exit working
      // TODO: Implement real vault partial withdrawal transaction
      logger.warn("⚠️  Real protection transactions not yet implemented")
      logger.warn("   Keeper bot can detect violations but cannot execute transactions yet")
      logger.warn("   Users must manually execute emergency exit from frontend")
      
      await this.simulateTransaction(vault, ilData)
      
    } catch (error) {
      logger.error(`❌ Protection execution failed for vault ${vault.vaultId}:`, error)
    }
  }

  private async simulateTransaction(vault: any, ilData: any) {
    logger.info(`📝 Simulating protection transaction for vault ${vault.vaultId}`)
    logger.info(`   Current IL: ${Math.abs(ilData.ilPercentage).toFixed(2)}%`)
    logger.info(`   LP Value: $${ilData.lpValue.toFixed(2)}`)
    logger.info(`   Hold Value: $${ilData.holdValue.toFixed(2)}`)
    logger.info(`   IL Loss: $${Math.abs(ilData.ilAmount).toFixed(2)}`)
    
    // Simulate transaction delay
    await this.sleep(2000)
    
    const txHash = "sim_" + Math.random().toString(36).substring(7)
    logger.info(`✅ Protection transaction simulated: ${txHash}`)
    
    // In a real implementation, we would:
    // 1. Build a partial withdrawal transaction from the vault
    // 2. Calculate optimal rebalancing strategy
    // 3. Submit transaction to blockchain
    // 4. Update vault state in database
    
    logger.info(`🎯 Protection simulation complete for vault ${vault.vaultId}`)
  }

  async healthCheck() {
    logger.debug("💓 Keeper bot health check...");
    
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      vaultsMonitored: 2, // Demo value
      lastCheck: new Date().toISOString(),
      status: this.isRunning ? "running" : "stopped"
    };
    
    logger.debug("📊 Health metrics:", metrics);
    return metrics;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}