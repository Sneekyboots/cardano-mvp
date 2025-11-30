/**
 * Standalone Test Suite for Midnight ZK AI Delegation Verification
 * 
 * Run with: npx ts-node src/test-midnight-zk.ts
 * 
 * This tests the ZK proof generation WITHOUT needing the full Midnight stack,
 * allowing us to verify the logic before full integration.
 */

import pino from 'pino';
import {
  AITransactionProver,
  type AITransaction,
  type ILPolicy,
  type DelegationProof,
  formatProofForCardano,
} from './midnight-zk-prover.js';

// Initialize logger
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

/**
 * Test 1: Generate a basic ZK proof
 */
async function testBasicProofGeneration(): Promise<void> {
  logger.info('🧪 TEST 1: Basic ZK Proof Generation');
  logger.info('=' .repeat(60));

  const prover = new AITransactionProver(logger, {
    network: 'testnet',
    verbose: true,
  });

  // Mock transaction from AI agent
  const aiTransaction: AITransaction = {
    transactionId: 'tx_ai_001',
    transactionHash: '0x' + 'a'.repeat(64),
    agentAddress: '0x' + 'b'.repeat(64),
    actionType: 'rebalance',
    vaultId: 'vault_12345',
    timestamp: Date.now(),
    data: {
      strategy: 'rebalance_to_1_1_ratio',
      poolId: 'pool_minswap_v2',
    },
  };

  // IL policy
  const ilPolicy: ILPolicy = {
    maxILPercent: 500, // 5% max IL
    policyHash: '0x' + 'c'.repeat(64),
    isActive: true,
  };

  // Current IL from keeper-bot calculation
  const currentIL = 300; // 3% - within limit

  try {
    // Generate proof
    const proof = await prover.generateDelegationProof(
      aiTransaction,
      ilPolicy,
      currentIL,
    );

    // Verify proof locally
    const isValid = prover.verifyProofLocally(proof);

    logger.info(`✅ Proof Generated: ${proof.proofId}`);
    logger.info(`   Valid: ${isValid}`);
    logger.info(`   Public IL Limit: ${proof.publicInputs.ilLimitPercent}%`);
    logger.info(`   Expires At: ${new Date(proof.expiresAt).toISOString()}`);
    logger.info(`   Proof Size: ${proof.proof.length} bytes (base64)`);

    if (!isValid) {
      throw new Error('Generated proof failed local verification!');
    }

    logger.info('✅ TEST 1 PASSED\n');
  } catch (error) {
    logger.error('❌ TEST 1 FAILED:', error);
    throw error;
  }
}

/**
 * Test 2: Verify IL constraint is enforced
 */
async function testILConstraintEnforcement(): Promise<void> {
  logger.info('🧪 TEST 2: IL Constraint Enforcement');
  logger.info('='.repeat(60));

  const prover = new AITransactionProver(logger, {
    network: 'testnet',
  });

  const aiTransaction: AITransaction = {
    transactionId: 'tx_ai_002',
    transactionHash: '0x' + 'a'.repeat(64),
    agentAddress: '0x' + 'b'.repeat(64),
    actionType: 'withdraw',
    vaultId: 'vault_12345',
    timestamp: Date.now(),
    data: { amount: 1000 },
  };

  const ilPolicy: ILPolicy = {
    maxILPercent: 300, // 3% max IL
    policyHash: '0x' + 'c'.repeat(64),
    isActive: true,
  };

  try {
    // Try to generate proof with IL EXCEEDING the limit
    const excessiveIL = 500; // 5% - exceeds the 3% limit

    logger.warn(`   Attempting proof with IL ${excessiveIL}% > limit ${ilPolicy.maxILPercent}%`);

    try {
      await prover.generateDelegationProof(aiTransaction, ilPolicy, excessiveIL);
      logger.error('❌ Should have rejected IL exceeding limit!');
      throw new Error('IL constraint was not enforced');
    } catch (error: any) {
      if (error.message.includes('exceeds policy limit')) {
        logger.info(`✅ Correctly rejected excessive IL: ${error.message}`);
      } else {
        throw error;
      }
    }

    // Now try with IL within limit
    const validIL = 200; // 2% - within 3% limit
    logger.info(`   Attempting proof with IL ${validIL}% <= limit ${ilPolicy.maxILPercent}%`);

    const proof = await prover.generateDelegationProof(aiTransaction, ilPolicy, validIL);
    const isValid = prover.verifyProofLocally(proof);

    if (!isValid) {
      throw new Error('Valid proof failed verification');
    }

    logger.info(`✅ Correctly accepted valid IL: ${validIL}%`);
    logger.info('✅ TEST 2 PASSED\n');
  } catch (error) {
    logger.error('❌ TEST 2 FAILED:', error);
    throw error;
  }
}

/**
 * Test 3: Batch proof generation
 */
async function testBatchProofGeneration(): Promise<void> {
  logger.info('🧪 TEST 3: Batch Proof Generation');
  logger.info('='.repeat(60));

  const prover = new AITransactionProver(logger, {
    network: 'testnet',
  });

  const transactions: AITransaction[] = [
    {
      transactionId: 'tx_batch_001',
      transactionHash: '0x' + 'a'.repeat(64),
      agentAddress: '0x' + 'b'.repeat(64),
      actionType: 'rebalance',
      vaultId: 'vault_001',
      timestamp: Date.now(),
      data: {},
    },
    {
      transactionId: 'tx_batch_002',
      transactionHash: '0x' + 'c'.repeat(64),
      agentAddress: '0x' + 'd'.repeat(64),
      actionType: 'withdraw',
      vaultId: 'vault_002',
      timestamp: Date.now(),
      data: {},
    },
    {
      transactionId: 'tx_batch_003',
      transactionHash: '0x' + 'e'.repeat(64),
      agentAddress: '0x' + 'f'.repeat(64),
      actionType: 'deposit',
      vaultId: 'vault_003',
      timestamp: Date.now(),
      data: {},
    },
  ];

  const ilPolicy: ILPolicy = {
    maxILPercent: 500,
    policyHash: '0x' + 'abc'.padEnd(64, '0'),
    isActive: true,
  };

  const currentILs = [200, 300, 150];

  try {
    const proofs = await prover.generateBatchProofs(transactions, ilPolicy, currentILs);

    logger.info(`✅ Generated ${proofs.length} proofs`);

    // Verify each proof
    let allValid = true;
    proofs.forEach((proof, index) => {
      const isValid = prover.verifyProofLocally(proof);
      logger.info(`   Proof ${index + 1}: ${isValid ? '✅' : '❌'} (ID: ${proof.proofId})`);
      allValid = allValid && isValid;
    });

    if (!allValid) {
      throw new Error('Some proofs failed verification');
    }

    logger.info('✅ TEST 3 PASSED\n');
  } catch (error) {
    logger.error('❌ TEST 3 FAILED:', error);
    throw error;
  }
}

/**
 * Test 4: Proof formatting for Cardano
 */
async function testCardanoProofFormatting(): Promise<void> {
  logger.info('🧪 TEST 4: Cardano Proof Formatting');
  logger.info('='.repeat(60));

  const prover = new AITransactionProver(logger, {
    network: 'testnet',
  });

  const aiTransaction: AITransaction = {
    transactionId: 'tx_cardano_001',
    transactionHash: '0x' + 'a'.repeat(64),
    agentAddress: '0x' + 'b'.repeat(64),
    actionType: 'rebalance',
    vaultId: 'vault_12345',
    timestamp: Date.now(),
    data: {},
  };

  const ilPolicy: ILPolicy = {
    maxILPercent: 500,
    policyHash: '0x' + 'c'.repeat(64),
    isActive: true,
  };

  try {
    const proof = await prover.generateDelegationProof(aiTransaction, ilPolicy, 300);
    const cardanoProof = formatProofForCardano(proof);

    logger.info('✅ Proof formatted for Cardano:');
    logger.info(`   Proof ID: ${cardanoProof.proofId}`);
    logger.info(`   Public Inputs: ${JSON.stringify(cardanoProof.publicInputs)}`);
    logger.info(`   Proof Size: ${cardanoProof.proof.length} bytes`);

    // Verify format
    if (!cardanoProof.proof || !cardanoProof.publicInputs || !cardanoProof.proofId) {
      throw new Error('Invalid Cardano proof format');
    }

    logger.info('✅ TEST 4 PASSED\n');
  } catch (error) {
    logger.error('❌ TEST 4 FAILED:', error);
    throw error;
  }
}

/**
 * Test 5: Proof expiration
 */
async function testProofExpiration(): Promise<void> {
  logger.info('🧪 TEST 5: Proof Expiration');
  logger.info('='.repeat(60));

  const prover = new AITransactionProver(logger, {
    network: 'testnet',
  });

  const aiTransaction: AITransaction = {
    transactionId: 'tx_expiry_001',
    transactionHash: '0x' + 'a'.repeat(64),
    agentAddress: '0x' + 'b'.repeat(64),
    actionType: 'rebalance',
    vaultId: 'vault_12345',
    timestamp: Date.now(),
    data: {},
  };

  const ilPolicy: ILPolicy = {
    maxILPercent: 500,
    policyHash: '0x' + 'c'.repeat(64),
    isActive: true,
  };

  try {
    const proof = await prover.generateDelegationProof(aiTransaction, ilPolicy, 300);

    // Verify fresh proof is valid
    let isValid = prover.verifyProofLocally(proof);
    logger.info(`✅ Fresh proof is valid: ${isValid}`);

    // Simulate proof expiration
    proof.expiresAt = Date.now() - 1000; // Set expiration to 1 second ago

    isValid = prover.verifyProofLocally(proof);
    logger.info(`✅ Expired proof is invalid: ${!isValid}`);

    if (isValid) {
      throw new Error('Expired proof should not be valid');
    }

    logger.info('✅ TEST 5 PASSED\n');
  } catch (error) {
    logger.error('❌ TEST 5 FAILED:', error);
    throw error;
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  logger.info('\n');
  logger.info('🚀 MIDNIGHT ZK AI DELEGATION VERIFICATION');
  logger.info('🚀 Standalone Test Suite');
  logger.info('='.repeat(60));
  logger.info('\n');

  try {
    await testBasicProofGeneration();
    await testILConstraintEnforcement();
    await testBatchProofGeneration();
    await testCardanoProofFormatting();
    await testProofExpiration();

    logger.info('='.repeat(60));
    logger.info('✅ ALL TESTS PASSED! 🎉\n');
    logger.info('Next steps:');
    logger.info('1. Integrate with full Midnight SDK');
    logger.info('2. Deploy ZK circuit to Midnight testnet');
    logger.info('3. Update Cardano validator to verify proofs');
    logger.info('4. Full end-to-end testing\n');
  } catch (error) {
    logger.error('='.repeat(60));
    logger.error('❌ TEST SUITE FAILED\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
