use aiken/builtin
use aiken/list
use aiken/transaction/value.{Value, quantity_of}
use yield_safe/types.{Asset}

// ============================================================================
// MATHEMATICAL UTILITIES
// ============================================================================

/// Calculate percentage with precision (returns basis points)
/// Example: calculate_percentage(1, 4) = 2500 (25.00%)
pub fn calculate_percentage(numerator: Int, denominator: Int) -> Int {
  if denominator == 0 {
    0
  } else {
    numerator * 10000 / denominator
  }
}

/// Calculate impermanent loss percentage (simplified)
pub fn calculate_il_simple(price_change_ratio: Int) -> Int {
  // Simplified IL calculation for demonstration
  // Real implementation would use sqrt and more complex math
  if price_change_ratio >= 10000 {
    // Price increased
    let excess = price_change_ratio - 10000
    -(excess / 10)  // Negative indicates loss
  } else {
    // Price decreased  
    let deficit = 10000 - price_change_ratio
    -(deficit / 10)  // Negative indicates loss
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/// Check if user has signed the transaction
pub fn signed_by_user(
  user_pubkey: ByteArray,
  signatories: List<ByteArray>
) -> Bool {
  list.has(signatories, user_pubkey)
}

/// Check if asset quantity meets minimum requirements
pub fn has_minimum_asset(value: Value, asset: Asset, min_amount: Int) -> Bool {
  let asset_amount = quantity_of(value, asset.policy_id, asset.token_name)
  asset_amount >= min_amount
}

/// Validate asset ratio is reasonable (prevents division by zero)
pub fn valid_asset_ratio(asset_a: Int, asset_b: Int) -> Bool {
  asset_a > 0 && asset_b > 0
}

/// Check if timestamp is within acceptable range (not too old)
pub fn valid_timestamp(timestamp: Int, current_time: Int, max_age_seconds: Int) -> Bool {
  current_time - timestamp <= max_age_seconds
}