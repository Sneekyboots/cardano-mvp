import { AssetRatio, ILData, PoolState } from "../types/index.js";

/**
 * Impermanent Loss Calculator
 * 
 * Implements the mathematical formulas for calculating impermanent loss
 * in automated market maker (AMM) pools using the constant product formula.
 */
export class ILCalculator {
  
  /**
   * Calculate the square root of a BigInt using Newton's method
   * Used for geometric mean calculations in IL formulas
   */
  private sqrt(n: bigint): bigint {
    if (n === 0n) return 0n;
    if (n < 4n) return 1n;
    
    let x = n;
    let y = (n + 1n) / 2n;
    
    while (y < x) {
      x = y;
      y = (x + n / x) / 2n;
    }
    
    return x;
  }
  
  /**
   * Calculate geometric mean of two numbers
   * Used in price ratio calculations for IL
   */
  private geometricMean(a: bigint, b: bigint): bigint {
    return this.sqrt(a * b);
  }
  
  /**
   * Calculate price ratio between two asset ratios
   * Returns the ratio scaled by 10000 for precision
   */
  private calculatePriceRatio(initial: AssetRatio, current: AssetRatio): bigint {
    // Convert ratios to price (asset_a / asset_b)
    const initialPrice = (initial.assetAAmount * 10000n) / initial.assetBAmount;
    const currentPrice = (current.assetAAmount * 10000n) / current.assetBAmount;
    
    // Price ratio (how much price changed)
    return (currentPrice * 10000n) / initialPrice;
  }
  
  /**
   * Calculate impermanent loss percentage
   * 
   * Formula: IL = (2 * sqrt(price_ratio) / (1 + price_ratio)) - 1
   * 
   * @param initialRatio - Asset ratio when LP position was opened
   * @param currentRatio - Current asset ratio from pool
   * @returns IL percentage in basis points (negative value indicates loss)
   */
  calculateImpermanentLoss(initialRatio: AssetRatio, currentRatio: AssetRatio): number {
    // Get price ratio scaled by 10000
    const priceRatio = this.calculatePriceRatio(initialRatio, currentRatio);
    
    // IL formula: 2 * sqrt(r) / (1 + r) - 1
    const sqrtRatio = this.sqrt(priceRatio);
    const numerator = 2n * sqrtRatio * 10000n;
    const denominator = 10000n + priceRatio;
    const lpMultiplier = numerator / denominator;
    
    // Convert to number and return IL percentage (negative indicates loss)
    return Number(lpMultiplier - 10000n);
  }
  
  /**
   * Calculate HODL value vs LP value comparison
   * 
   * @param initialDeposit - Original deposit amount in lovelace
   * @param initialRatio - Asset ratio at deposit time
   * @param currentRatio - Current asset ratio
   * @param currentLPTokens - Current LP tokens held
   * @param poolState - Current pool state
   * @returns Tuple of [hodlValue, lpValue] in lovelace
   */
  calculateHodlVsLP(
    initialDeposit: bigint,
    initialRatio: AssetRatio,
    currentRatio: AssetRatio,
    currentLPTokens: bigint,
    poolState: PoolState
  ): [bigint, bigint] {
    
    // Calculate what half the initial deposit was worth in each asset
    const initialAssetA = initialDeposit / 2n;
    const initialAssetB = initialDeposit / 2n;
    
    // Calculate current HODL value (same amounts, current prices)
    // Simplified: assumes both assets have same value in ADA terms for calculation
    const priceChangeA = currentRatio.assetAAmount / initialRatio.assetAAmount;
    const priceChangeB = currentRatio.assetBAmount / initialRatio.assetBAmount;
    
    const currentAssetAValue = initialAssetA * priceChangeA;
    const currentAssetBValue = initialAssetB * priceChangeB;
    const hodlValue = currentAssetAValue + currentAssetBValue;
    
    // Calculate current LP value based on pool reserves
    const lpShare = (currentLPTokens * 10000n) / poolState.totalLPTokens;
    const lpAssetA = (poolState.reserveA * lpShare) / 10000n;
    const lpAssetB = (poolState.reserveB * lpShare) / 10000n;
    
    // Convert to ADA equivalent (simplified calculation)
    const lpValue = lpAssetA + lpAssetB;
    
    return [hodlValue, lpValue];
  }
  
  /**
   * Create complete IL data structure with all calculations
   */
  createILData(
    initialRatio: AssetRatio,
    currentRatio: AssetRatio,
    initialDeposit: bigint,
    currentLPTokens: bigint,
    poolState: PoolState
  ): ILData {
    
    const ilPercentage = this.calculateImpermanentLoss(initialRatio, currentRatio);
    const [hodlValue, lpValue] = this.calculateHodlVsLP(
      initialDeposit,
      initialRatio,
      currentRatio,
      currentLPTokens,
      poolState
    );
    
    return {
      initialRatio,
      currentRatio,
      ilPercentage,
      hodlValue,
      lpValue
    };
  }
  
  /**
   * Check if IL exceeds the user's policy threshold
   */
  violatesILPolicy(ilData: ILData, maxILPercent: number): boolean {
    // IL is negative for losses, so we check absolute value
    return Math.abs(ilData.ilPercentage) > Math.abs(maxILPercent);
  }
  
  /**
   * Calculate the urgency level based on how much IL exceeds policy
   */
  calculateUrgency(currentIL: number, maxAllowed: number): "low" | "medium" | "high" {
    const excess = Math.abs(currentIL) - Math.abs(maxAllowed);
    
    if (excess <= 100) { // 1% over limit
      return "low";
    } else if (excess <= 500) { // 5% over limit
      return "medium";
    } else {
      return "high";
    }
  }
  
  /**
   * Estimate potential loss in ADA if position is not protected
   */
  estimatePotentialLoss(ilData: ILData): bigint {
    if (ilData.hodlValue > ilData.lpValue) {
      return ilData.hodlValue - ilData.lpValue;
    }
    return 0n;
  }
  
  /**
   * Calculate optimal exit timing based on IL trajectory
   * Returns recommended action: "hold", "alert", "exit"
   */
  recommendAction(
    currentIL: number,
    maxIL: number,
    ilHistory: number[],
    timeWindow: number = 300 // 5 minutes
  ): "hold" | "alert" | "exit" {
    
    // If currently over limit, recommend exit
    if (Math.abs(currentIL) > Math.abs(maxIL)) {
      return "exit";
    }
    
    // If approaching limit and trending upward, alert
    const threshold = Math.abs(maxIL) * 0.8; // 80% of limit
    if (Math.abs(currentIL) > threshold) {
      
      // Check if IL is increasing rapidly
      if (ilHistory.length >= 2) {
        const recent = ilHistory.slice(-3); // Last 3 readings
        const trend = recent[recent.length - 1] - recent[0];
        
        if (Math.abs(trend) > 50) { // Rapid change > 0.5%
          return "alert";
        }
      }
    }
    
    return "hold";
  }
  
  /**
   * Calculate the effective annual percentage rate (APR) from IL protection
   * Takes into account fees paid vs losses prevented
   */
  calculateProtectionAPR(
    totalFesPaid: bigint,
    totalLossesPrevented: bigint,
    timeperiodDays: number,
    principalAmount: bigint
  ): number {
    
    const netBenefit = totalLossesPrevented - totalFesPaid;
    const dailyRate = Number(netBenefit) / Number(principalAmount) / timeperiodDays;
    const annualRate = dailyRate * 365 * 100; // Convert to percentage
    
    return annualRate;
  }
}