use aiken/builtin
use aiken/bytearray
use aiken/hash.{Blake2b_224, Hash}
use aiken/list
use aiken/option
use aiken/transaction.{
  Input, Output, ScriptContext, Spend, Transaction, ValidityRange,
}
use aiken/transaction/credential.{Address, Credential, VerificationKeyCredential}
use aiken/transaction/value.{AssetName, PolicyId, Value, quantity_of}

// ============================================================================
// TYPES
// ============================================================================

/// Asset definition (PolicyID + TokenName)
pub type Asset {
  policy_id: PolicyId,
  token_name: AssetName,
}

/// Asset ratio for price tracking
pub type AssetRatio {
  asset_a_amount: Int,
  asset_b_amount: Int,
}

/// User's IL protection policy
pub type UserPolicy {
  max_il_percent: Int,        // Maximum IL% allowed (e.g., 500 = 5%)
  deposit_ratio: AssetRatio,  // Original asset ratio at deposit
  emergency_withdraw: Bool,   // Allow force withdrawal
}

/// Vault datum containing user funds and policy
pub type VaultDatum {
  owner: ByteArray,  // Vault owner public key hash
  policy: UserPolicy,         // IL protection rules
  lp_asset: Asset,           // LP token being protected
  deposit_amount: Int,       // Original LP deposit amount  
  deposit_time: Int,         // POSIX timestamp of deposit
}

/// Actions users can perform on vault
pub type VaultRedeemer {
  Deposit { amount: Int }
  Withdraw { amount: Int, current_il: Int }
  UpdatePolicy { new_policy: UserPolicy }
  EmergencyExit
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Calculate percentage (basis points to avoid decimals)
/// Returns percentage * 100 (e.g., 500 = 5.00%)
fn calculate_percentage(numerator: Int, denominator: Int) -> Int {
  if denominator == 0 {
    0
  } else {
    numerator * 10000 / denominator
  }
}

/// Check if current IL exceeds user's policy limit
fn il_within_policy(current_il: Int, max_il: Int) -> Bool {
  current_il <= max_il
}

/// Validate that the owner signed the transaction
fn signed_by_owner(owner: ByteArray, signatories: List<ByteArray>) -> Bool {
  list.has(signatories, owner)
}

/// Check if asset is present in value with minimum amount
fn has_minimum_asset(value: Value, asset: Asset, min_amount: Int) -> Bool {
  let asset_amount = quantity_of(value, asset.policy_id, asset.token_name)
  asset_amount >= min_amount
}

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

validator {
  fn vault_validator(
    datum: VaultDatum, 
    redeemer: VaultRedeemer, 
    context: ScriptContext
  ) -> Bool {
    
    expect Spend(own_ref) = context.purpose
    expect Some(own_input) = transaction.find_input(context.transaction.inputs, own_ref)
    expect Some(own_output) = list.at(context.transaction.outputs, 0)
    
    let VaultDatum {
      owner,
      policy,
      lp_asset,
      deposit_amount,
      deposit_time,
    } = datum
    
    let UserPolicy {
      max_il_percent,
      deposit_ratio,
      emergency_withdraw,
    } = policy
    
    // Common validations
    let signed_by_owner = signed_by_owner(owner, context.transaction.extra_signatories)
    
    when redeemer is {
      
      // User deposits LP tokens into vault
      Deposit { amount } -> {
        let valid_signature = signed_by_owner
        let valid_amount = amount > 0
        
        // Check LP token is actually deposited
        let input_lp_amount = quantity_of(own_input.output.value, lp_asset.policy_id, lp_asset.token_name)
        let output_lp_amount = quantity_of(own_output.value, lp_asset.policy_id, lp_asset.token_name)
        let correct_deposit = output_lp_amount == input_lp_amount + amount
        
        // Datum should be updated
        expect VaultDatum { deposit_amount: new_deposit_amount, .. } = own_output.datum
        let correct_datum_update = new_deposit_amount == deposit_amount + amount
        
        valid_signature && valid_amount && correct_deposit && correct_datum_update
      }
      
      // User withdraws LP tokens (subject to IL policy)
      Withdraw { amount, current_il } -> {
        let valid_signature = signed_by_owner
        let valid_amount = amount > 0 && amount <= deposit_amount
        
        // IL policy check (can be bypassed with emergency withdraw)
        let il_check = 
          if emergency_withdraw {
            True  // Emergency exit bypasses IL policy
          } else {
            il_within_policy(current_il, max_il_percent)
          }
        
        // Check LP tokens are actually withdrawn
        let input_lp_amount = quantity_of(own_input.output.value, lp_asset.policy_id, lp_asset.token_name)
        let output_lp_amount = quantity_of(own_output.value, lp_asset.policy_id, lp_asset.token_name)
        let correct_withdrawal = output_lp_amount == input_lp_amount - amount
        
        // Datum should be updated
        expect VaultDatum { deposit_amount: new_deposit_amount, .. } = own_output.datum
        let correct_datum_update = new_deposit_amount == deposit_amount - amount
        
        valid_signature && valid_amount && il_check && correct_withdrawal && correct_datum_update
      }
      
      // User updates their IL policy
      UpdatePolicy { new_policy } -> {
        let valid_signature = signed_by_owner
        
        // Validate new policy parameters
        let valid_policy = 
          new_policy.max_il_percent >= 0 && 
          new_policy.max_il_percent <= 10000 &&  // Max 100% IL
          new_policy.deposit_ratio.asset_a_amount > 0 &&
          new_policy.deposit_ratio.asset_b_amount > 0
        
        // LP tokens should remain unchanged
        let lp_unchanged = own_input.output.value == own_output.value
        
        // Only policy should change in datum
        expect VaultDatum { 
          policy: updated_policy,
          owner: same_owner,
          lp_asset: same_lp_asset,
          deposit_amount: same_deposit_amount,
          deposit_time: same_deposit_time,
        } = own_output.datum
        
        let datum_correct = 
          updated_policy == new_policy &&
          same_owner == owner &&
          same_lp_asset == lp_asset &&
          same_deposit_amount == deposit_amount &&
          same_deposit_time == deposit_time
        
        valid_signature && valid_policy && lp_unchanged && datum_correct
      }
      
      // Emergency exit - withdraw all funds regardless of IL
      EmergencyExit -> {
        let valid_signature = signed_by_owner
        let emergency_enabled = emergency_withdraw
        
        // All LP tokens should be withdrawn
        let input_lp_amount = quantity_of(own_input.output.value, lp_asset.policy_id, lp_asset.token_name)
        let no_output_to_script = True  // This consumes the UTxO entirely
        
        valid_signature && emergency_enabled && input_lp_amount > 0 && no_output_to_script
      }
    }
  }
}