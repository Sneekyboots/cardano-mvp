use aiken/transaction/value.{AssetName, PolicyId}

// ============================================================================
// CORE TYPES  
// ============================================================================

/// Asset definition (PolicyID + TokenName)
pub type Asset {
  policy_id: PolicyId,
  token_name: AssetName,
}

/// Asset ratio for price tracking and IL calculations
pub type AssetRatio {
  asset_a_amount: Int,
  asset_b_amount: Int,
}

/// Pool state at a specific point in time
pub type PoolState {
  reserve_a: Int,           // Amount of asset A in pool
  reserve_b: Int,           // Amount of asset B in pool  
  total_lp_tokens: Int,     // Total LP tokens in circulation
  last_update_time: Int,    // POSIX timestamp of last update
}

/// User's IL protection configuration
pub type UserPolicy {
  max_il_percent: Int,          // Maximum IL% allowed (basis points)
  deposit_ratio: AssetRatio,    // Original asset ratio at deposit
  emergency_withdraw: Bool,     // Allow force withdrawal
}

/// Vault datum containing user funds and policy
pub type VaultDatum {
  owner: ByteArray,  // Vault owner public key hash
  policy: UserPolicy,           // IL protection rules
  lp_asset: Asset,             // LP token being protected
  deposit_amount: Int,         // Original LP deposit amount  
  deposit_time: Int,           // POSIX timestamp of deposit
  initial_pool_state: PoolState, // Pool state when position opened
}