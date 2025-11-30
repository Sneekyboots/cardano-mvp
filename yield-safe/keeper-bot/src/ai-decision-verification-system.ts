/**
 * AI Decision-Execution Verification System
 * 
 * Tests the complete flow:
 * 1. AI makes a decision (delegate 1000 ADA)
 * 2. Generate ZK proof of that decision
 * 3. Execute transaction in vault
 * 4. Verify execution matches the proof
 * 5. Revert if there's a mismatch
 */

import crypto from 'crypto';
import pino from 'pino';

const logger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// ============================================================================
// Type Definitions
// ============================================================================

export interface AIDecision {
  decisionId: string;
  agentId: string;
  action: 'delegate' | 'withdraw' | 'rebalance';
  amount: number;
  targetPool: string;
  ilImpact: number;
  expectedGasUsed: number;
  timestamp: number;
}

export interface ZKProof {
  proofId: string;
  decisionHash: string;
  publicInputs: {
    ilLimit: number;
    agentAddress: string;
    policyHash: string;
  };
  proof: string; // base64
  expiresAt: number;
}

export interface ExecutedTransaction {
  txHash: string;
  action: string;
  amount: number;
  targetPool: string;
  ilImpact: number;
  gasUsed: number;
  timestamp: number;
  blockNumber: number;
}

export interface VerificationResult {
  passed: boolean;
  decision: AIDecision;
  executedTx: ExecutedTransaction;
  proof: ZKProof;
  mismatches: string[];
  action: 'EXECUTE' | 'REVERT';
}

// ============================================================================
// Decision Generator
// ============================================================================

export class AIDecisionGenerator {
  generateDecision(
    agentId: string,
    action: 'delegate' | 'withdraw' | 'rebalance',
    amount: number,
    targetPool: string
  ): AIDecision {
    return {
      decisionId: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      action,
      amount,
      targetPool,
      ilImpact: Math.floor(Math.random() * 400) + 50, // 50-450%
      expectedGasUsed: 300000 + Math.floor(Math.random() * 100000),
      timestamp: Date.now(),
    };
  }

  hashDecision(decision: AIDecision): string {
    const data = JSON.stringify({
      action: decision.action,
      amount: decision.amount,
      targetPool: decision.targetPool,
      ilImpact: decision.ilImpact,
      agentId: decision.agentId,
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// ============================================================================
// ZK Proof Generator
// ============================================================================

export class ZKProofGenerator {
  generateProof(
    decision: AIDecision,
    decisionHash: string,
    policyHash: string
  ): ZKProof {
    const proof: ZKProof = {
      proofId: `proof_${decision.decisionId}`,
      decisionHash,
      publicInputs: {
        ilLimit: 500, // 5% max IL
        agentAddress: decision.agentId,
        policyHash,
      },
      proof: Buffer.from(
        JSON.stringify({
          circuit: 'verify_ai_decision_execution',
          decision_hash: decisionHash,
          il_verified: decision.ilImpact <= 500,
          agent_verified: !!decision.agentId,
          policy_verified: !!policyHash,
        })
      ).toString('base64'),
      expiresAt: Date.now() + 3600000, // 1 hour
    };

    logger.debug(`Generated ZK proof: ${proof.proofId}`);
    return proof;
  }
}

// ============================================================================
// Execution Simulator
// ============================================================================

export class ExecutionSimulator {
  /**
   * Simulate vault execution
   * Can introduce mismatches for testing revert behavior
   */
  simulateExecution(
    decision: AIDecision,
    proof: ZKProof,
    mismatchType?: 'amount' | 'action' | 'pool' | 'il' | 'gas' | 'none'
  ): ExecutedTransaction {
    let actualAmount = decision.amount;
    let actualAction = decision.action;
    let actualPool = decision.targetPool;
    let actualIL = decision.ilImpact;
    let actualGas = decision.expectedGasUsed;

    // Introduce mismatches for testing revert scenarios
    switch (mismatchType) {
      case 'amount':
        // Execute different amount
        actualAmount = decision.amount * 1.2; // 20% more
        logger.warn(`❌ Introducing amount mismatch: ${actualAmount} vs ${decision.amount}`);
        break;

      case 'action':
        // Execute different action
        const actions = ['delegate', 'withdraw', 'rebalance'];
        actualAction = actions[Math.floor(Math.random() * 3)] as any;
        if (actualAction === decision.action) actualAction = 'withdraw';
        logger.warn(`❌ Introducing action mismatch: ${actualAction} vs ${decision.action}`);
        break;

      case 'pool':
        // Execute on different pool
        actualPool = decision.targetPool + '_fake';
        logger.warn(`❌ Introducing pool mismatch: ${actualPool} vs ${decision.targetPool}`);
        break;

      case 'il':
        // IL impact higher than expected
        actualIL = decision.ilImpact * 1.5; // 50% higher
        logger.warn(`❌ Introducing IL mismatch: ${actualIL} vs ${decision.ilImpact}`);
        break;

      case 'gas':
        // Gas usage much higher
        actualGas = decision.expectedGasUsed * 2;
        logger.warn(`❌ Introducing gas mismatch: ${actualGas} vs ${decision.expectedGasUsed}`);
        break;

      case 'none':
      default:
        // Perfect execution - no mismatches
        logger.info(`✅ Perfect execution - no mismatches`);
        break;
    }

    const tx: ExecutedTransaction = {
      txHash: `0x${crypto.randomBytes(32).toString('hex')}`,
      action: actualAction,
      amount: actualAmount,
      targetPool: actualPool,
      ilImpact: actualIL,
      gasUsed: actualGas,
      timestamp: Date.now(),
      blockNumber: Math.floor(Math.random() * 1000000),
    };

    logger.debug(`Executed transaction: ${tx.txHash}`);
    return tx;
  }
}

// ============================================================================
// Verification Engine
// ============================================================================

export class VerificationEngine {
  /**
   * Verify that executed transaction matches the ZK proof
   */
  verify(
    decision: AIDecision,
    executedTx: ExecutedTransaction,
    proof: ZKProof
  ): VerificationResult {
    const mismatches: string[] = [];

    logger.info(`\n🔍 VERIFYING EXECUTION`);
    logger.info(`=`.repeat(60));

    // Check 1: Action type matches
    logger.debug(`Checking action: ${decision.action} vs ${executedTx.action}`);
    if (decision.action !== executedTx.action) {
      const msg = `Action mismatch: decided [${decision.action}] but executed [${executedTx.action}]`;
      mismatches.push(msg);
      logger.error(`❌ ${msg}`);
    } else {
      logger.info(`✅ Action verified: ${decision.action}`);
    }

    // Check 2: Amount matches (within 0.1% tolerance)
    logger.debug(`Checking amount: ${decision.amount} vs ${executedTx.amount}`);
    const amountTolerance = decision.amount * 0.001;
    if (Math.abs(decision.amount - executedTx.amount) > amountTolerance) {
      const msg = `Amount mismatch: decided [${decision.amount}] but executed [${executedTx.amount}]`;
      mismatches.push(msg);
      logger.error(`❌ ${msg}`);
    } else {
      logger.info(`✅ Amount verified: ${executedTx.amount}`);
    }

    // Check 3: Target pool matches
    logger.debug(`Checking pool: ${decision.targetPool} vs ${executedTx.targetPool}`);
    if (decision.targetPool !== executedTx.targetPool) {
      const msg = `Pool mismatch: decided [${decision.targetPool}] but executed [${executedTx.targetPool}]`;
      mismatches.push(msg);
      logger.error(`❌ ${msg}`);
    } else {
      logger.info(`✅ Target pool verified: ${executedTx.targetPool}`);
    }

    // Check 4: IL impact within limits (5% tolerance)
    logger.debug(`Checking IL: ${decision.ilImpact} vs ${executedTx.ilImpact}`);
    const ilTolerance = decision.ilImpact * 0.05;
    if (Math.abs(decision.ilImpact - executedTx.ilImpact) > ilTolerance) {
      const msg = `IL impact exceeded: decided [${decision.ilImpact}%] but got [${executedTx.ilImpact}%]`;
      mismatches.push(msg);
      logger.error(`❌ ${msg}`);
    } else {
      logger.info(`✅ IL impact verified: ${executedTx.ilImpact}%`);
    }

    // Check 5: Gas usage reasonable (50% tolerance)
    logger.debug(`Checking gas: ${decision.expectedGasUsed} vs ${executedTx.gasUsed}`);
    const gasTolerance = decision.expectedGasUsed * 0.5;
    if (Math.abs(decision.expectedGasUsed - executedTx.gasUsed) > gasTolerance) {
      const msg = `Gas exceeded: expected [${decision.expectedGasUsed}] but used [${executedTx.gasUsed}]`;
      mismatches.push(msg);
      logger.error(`❌ ${msg}`);
    } else {
      logger.info(`✅ Gas usage verified: ${executedTx.gasUsed}`);
    }

    // Check 6: Proof hasn't expired
    logger.debug(`Checking proof expiration`);
    if (Date.now() > proof.expiresAt) {
      mismatches.push('ZK proof has expired');
      logger.error(`❌ ZK proof has expired`);
    } else {
      logger.info(`✅ ZK proof still valid (expires in ${Math.round((proof.expiresAt - Date.now()) / 1000)}s)`);
    }

    // Check 7: Proof decision hash matches
    logger.debug(`Checking proof hash match`);
    const decisionGen = new AIDecisionGenerator();
    const expectedHash = decisionGen.hashDecision(decision);
    if (proof.decisionHash !== expectedHash) {
      mismatches.push('Proof decision hash does not match');
      logger.error(`❌ Proof hash mismatch`);
    } else {
      logger.info(`✅ Proof hash verified`);
    }

    logger.info(`=`.repeat(60));

    const passed = mismatches.length === 0;
    const action = passed ? ('EXECUTE' as const) : ('REVERT' as const);

    return {
      passed,
      decision,
      executedTx,
      proof,
      mismatches,
      action,
    };
  }
}

// ============================================================================
// Main Test Orchestrator
// ============================================================================

export class AIVaultTestOrchestrator {
  private decisionGen: AIDecisionGenerator;
  private proofGen: ZKProofGenerator;
  private executor: ExecutionSimulator;
  private verifier: VerificationEngine;

  constructor() {
    this.decisionGen = new AIDecisionGenerator();
    this.proofGen = new ZKProofGenerator();
    this.executor = new ExecutionSimulator();
    this.verifier = new VerificationEngine();
  }

  /**
   * Run a complete test scenario
   */
  async runTest(
    testName: string,
    mismatchType?: 'amount' | 'action' | 'pool' | 'il' | 'gas' | 'none'
  ): Promise<VerificationResult> {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`🧪 TEST: ${testName}`);
    logger.info(`${'='.repeat(60)}\n`);

    // Step 1: AI makes decision
    logger.info(`📍 STEP 1: AI DECISION`);
    const decision = this.decisionGen.generateDecision(
      'agent_ai_001',
      'delegate',
      1000,
      'minswap_ada_snek'
    );
    logger.info(`Decision ID: ${decision.decisionId}`);
    logger.info(`Action: ${decision.action}`);
    logger.info(`Amount: ${decision.amount} ADA`);
    logger.info(`Pool: ${decision.targetPool}`);
    logger.info(`IL Impact: ${decision.ilImpact}%`);
    logger.info(`Expected Gas: ${decision.expectedGasUsed}`);

    // Step 2: Generate ZK proof
    logger.info(`\n📍 STEP 2: GENERATE ZK PROOF`);
    const decisionHash = this.decisionGen.hashDecision(decision);
    logger.info(`Decision Hash: ${decisionHash}`);
    const proof = this.proofGen.generateProof(
      decision,
      decisionHash,
      'policy_il_protection_001'
    );
    logger.info(`Proof ID: ${proof.proofId}`);
    logger.info(`Proof expires in: 1 hour`);

    // Step 3: Execute transaction
    logger.info(`\n📍 STEP 3: EXECUTE TRANSACTION`);
    const executedTx = this.executor.simulateExecution(
      decision,
      proof,
      mismatchType
    );
    logger.info(`Transaction Hash: ${executedTx.txHash}`);
    logger.info(`Executed Action: ${executedTx.action}`);
    logger.info(`Executed Amount: ${executedTx.amount} ADA`);
    logger.info(`Executed Pool: ${executedTx.targetPool}`);
    logger.info(`Actual IL Impact: ${executedTx.ilImpact}%`);
    logger.info(`Gas Used: ${executedTx.gasUsed}`);
    logger.info(`Block: ${executedTx.blockNumber}`);

    // Step 4: Verify
    logger.info(`\n📍 STEP 4: VERIFY EXECUTION`);
    const result = this.verifier.verify(decision, executedTx, proof);

    // Step 5: Report
    logger.info(`\n📍 FINAL RESULT`);
    if (result.passed) {
      logger.info(`✅ VERIFICATION PASSED`);
      logger.info(`Action: ${result.action}`);
      logger.info(`Transaction will be EXECUTED`);
    } else {
      logger.error(`❌ VERIFICATION FAILED`);
      logger.error(`Mismatches found:`);
      result.mismatches.forEach((m) => logger.error(`   • ${m}`));
      logger.error(`Action: ${result.action}`);
      logger.error(`Transaction will be REVERTED`);
    }

    logger.info(`\n`);
    return result;
  }
}
