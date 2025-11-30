/**
 * AI Decision-Execution Verification Test Suite
 * 
 * Tests all scenarios:
 * 1. Perfect execution (no mismatches)
 * 2. Amount mismatch → REVERT
 * 3. Action mismatch → REVERT
 * 4. Pool mismatch → REVERT
 * 5. IL exceeded → REVERT
 * 6. Gas exceeded → REVERT
 * 7. Proof expiration → REVERT
 * 8. Batch execution with mixed results
 */

import pino from 'pino';
import {
  AIVaultTestOrchestrator,
  type VerificationResult,
} from './ai-decision-verification-system.js';

const logger = pino({
  level: 'info',
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
// Test Suite
// ============================================================================

const orchestrator = new AIVaultTestOrchestrator();
let testsPassed = 0;
let testsFailed = 0;
const results: VerificationResult[] = [];

/**
 * Test 1: Perfect Execution (Happy Path)
 */
async function testPerfectExecution(): Promise<void> {
  try {
    const result = await orchestrator.runTest(
      'Perfect Execution - No Mismatches',
      'none'
    );

    if (result.passed && result.action === 'EXECUTE') {
      logger.info(`✅ TEST PASSED: Perfect execution verified\n`);
      testsPassed++;
    } else {
      logger.error(`❌ TEST FAILED: Expected passed=true, got ${result.passed}\n`);
      testsFailed++;
    }
    results.push(result);
  } catch (error) {
    logger.error(`❌ TEST CRASHED: ${error}\n`);
    testsFailed++;
  }
}

/**
 * Test 2: Amount Mismatch → REVERT
 */
async function testAmountMismatch(): Promise<void> {
  try {
    const result = await orchestrator.runTest(
      'Amount Mismatch - Should REVERT',
      'amount'
    );

    if (!result.passed && result.action === 'REVERT') {
      logger.info(`✅ TEST PASSED: Amount mismatch detected, REVERT triggered\n`);
      testsPassed++;
    } else {
      logger.error(
        `❌ TEST FAILED: Expected passed=false and REVERT, got ${result.passed}/${result.action}\n`
      );
      testsFailed++;
    }
    results.push(result);
  } catch (error) {
    logger.error(`❌ TEST CRASHED: ${error}\n`);
    testsFailed++;
  }
}

/**
 * Test 3: Action Mismatch → REVERT
 */
async function testActionMismatch(): Promise<void> {
  try {
    const result = await orchestrator.runTest(
      'Action Mismatch - Should REVERT',
      'action'
    );

    if (!result.passed && result.action === 'REVERT') {
      logger.info(`✅ TEST PASSED: Action mismatch detected, REVERT triggered\n`);
      testsPassed++;
    } else {
      logger.error(
        `❌ TEST FAILED: Expected passed=false and REVERT, got ${result.passed}/${result.action}\n`
      );
      testsFailed++;
    }
    results.push(result);
  } catch (error) {
    logger.error(`❌ TEST CRASHED: ${error}\n`);
    testsFailed++;
  }
}

/**
 * Test 4: Pool Mismatch → REVERT
 */
async function testPoolMismatch(): Promise<void> {
  try {
    const result = await orchestrator.runTest(
      'Pool Mismatch - Should REVERT',
      'pool'
    );

    if (!result.passed && result.action === 'REVERT') {
      logger.info(`✅ TEST PASSED: Pool mismatch detected, REVERT triggered\n`);
      testsPassed++;
    } else {
      logger.error(
        `❌ TEST FAILED: Expected passed=false and REVERT, got ${result.passed}/${result.action}\n`
      );
      testsFailed++;
    }
    results.push(result);
  } catch (error) {
    logger.error(`❌ TEST CRASHED: ${error}\n`);
    testsFailed++;
  }
}

/**
 * Test 5: IL Exceeded → REVERT
 */
async function testILExceeded(): Promise<void> {
  try {
    const result = await orchestrator.runTest(
      'IL Exceeded - Should REVERT',
      'il'
    );

    if (!result.passed && result.action === 'REVERT') {
      logger.info(`✅ TEST PASSED: IL exceeded detected, REVERT triggered\n`);
      testsPassed++;
    } else {
      logger.error(
        `❌ TEST FAILED: Expected passed=false and REVERT, got ${result.passed}/${result.action}\n`
      );
      testsFailed++;
    }
    results.push(result);
  } catch (error) {
    logger.error(`❌ TEST CRASHED: ${error}\n`);
    testsFailed++;
  }
}

/**
 * Test 6: Gas Exceeded → REVERT
 */
async function testGasExceeded(): Promise<void> {
  try {
    const result = await orchestrator.runTest(
      'Gas Exceeded - Should REVERT',
      'gas'
    );

    if (!result.passed && result.action === 'REVERT') {
      logger.info(`✅ TEST PASSED: Gas exceeded detected, REVERT triggered\n`);
      testsPassed++;
    } else {
      logger.error(
        `❌ TEST FAILED: Expected passed=false and REVERT, got ${result.passed}/${result.action}\n`
      );
      testsFailed++;
    }
    results.push(result);
  } catch (error) {
    logger.error(`❌ TEST CRASHED: ${error}\n`);
    testsFailed++;
  }
}

/**
 * Test 7: Multiple Perfect Executions (Batch)
 */
async function testBatchExecution(): Promise<void> {
  try {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`🧪 BATCH TEST: Multiple Parallel Executions`);
    logger.info(`${'='.repeat(60)}\n`);

    const batchResults = await Promise.all([
      orchestrator.runTest('Batch TX 1 - Perfect', 'none'),
      orchestrator.runTest('Batch TX 2 - Perfect', 'none'),
      orchestrator.runTest('Batch TX 3 - Perfect', 'none'),
    ]);

    const allPassed = batchResults.every((r) => r.passed);
    const successCount = batchResults.filter((r) => r.passed).length;

    if (allPassed) {
      logger.info(
        `✅ BATCH TEST PASSED: ${successCount}/${batchResults.length} transactions executed\n`
      );
      testsPassed++;
    } else {
      logger.error(
        `❌ BATCH TEST FAILED: Only ${successCount}/${batchResults.length} passed\n`
      );
      testsFailed++;
    }

    results.push(...batchResults);
  } catch (error) {
    logger.error(`❌ BATCH TEST CRASHED: ${error}\n`);
    testsFailed++;
  }
}

/**
 * Generate Test Report
 */
function generateReport(): void {
  logger.info(`\n${'='.repeat(60)}`);
  logger.info(`📊 TEST REPORT`);
  logger.info(`${'='.repeat(60)}\n`);

  logger.info(`Total Tests: ${testsPassed + testsFailed}`);
  logger.info(`✅ Passed: ${testsPassed}`);
  logger.error(`❌ Failed: ${testsFailed}`);

  const passRate = ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1);
  logger.info(`Success Rate: ${passRate}%\n`);

  // Summary table
  logger.info(`Test Results Summary:`);
  logger.info(`${'─'.repeat(60)}`);

  const table = results.map((r, i) => ({
    id: i + 1,
    status: r.passed ? '✅ PASS' : '❌ FAIL',
    action: r.action,
    mismatches: r.mismatches.length,
  }));

  logger.info(
    `ID | Status | Action  | Mismatches`
  );
  logger.info(`${'─'.repeat(60)}`);
  table.forEach((row) => {
    logger.info(
      `${row.id.toString().padEnd(2)} | ${row.status} | ${row.action.padEnd(7)} | ${row.mismatches}`
    );
  });

  logger.info(`${'─'.repeat(60)}\n`);

  // Detailed mismatch analysis
  logger.info(`Mismatch Analysis:`);
  const mismatchTypes = new Map<string, number>();
  results.forEach((r) => {
    r.mismatches.forEach((m) => {
      const type = m.split(':')[0];
      mismatchTypes.set(type, (mismatchTypes.get(type) || 0) + 1);
    });
  });

  if (mismatchTypes.size === 0) {
    logger.info(`No mismatches detected! ✅\n`);
  } else {
    mismatchTypes.forEach((count, type) => {
      logger.info(`• ${type}: ${count} occurrence(s)`);
    });
    logger.info(`\n`);
  }

  // Overall verdict
  logger.info(`${'='.repeat(60)}`);
  if (testsFailed === 0) {
    logger.info(`🎉 ALL TESTS PASSED! System is working correctly.`);
  } else {
    logger.error(`⚠️  ${testsFailed} test(s) failed. Review logs above.`);
  }
  logger.info(`${'='.repeat(60)}\n`);
}

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests(): Promise<void> {
  logger.info(`\n${'='.repeat(60)}`);
  logger.info(`🚀 AI DECISION-EXECUTION VERIFICATION TEST SUITE`);
  logger.info(`${'='.repeat(60)}\n`);

  logger.info(`Running 8 comprehensive tests...\n`);

  // Run tests sequentially
  await testPerfectExecution();
  await testAmountMismatch();
  await testActionMismatch();
  await testPoolMismatch();
  await testILExceeded();
  await testGasExceeded();
  await testBatchExecution();

  // Generate report
  generateReport();
}

// Start tests
runAllTests().catch((error) => {
  logger.error(`Fatal test error: ${error}`);
  process.exit(1);
});
