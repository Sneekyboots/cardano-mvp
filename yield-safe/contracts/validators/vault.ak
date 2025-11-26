use aiken/list
use aiken/transaction.{ScriptContext, Spend}
use aiken/transaction/value.{quantity_of}
use yield_safe/types.{Asset, AssetRatio, UserPolicy, VaultDatum}

/// Actions users can perform on vault
pub type VaultRedeemer {
  Deposit { amount: Int }
  Withdraw { amount: Int, current_il: Int }
  UpdatePolicy { new_policy: UserPolicy }
  EmergencyExit
}

/// Check if current IL exceeds user's policy limit
fn il_within_policy(current_il: Int, max_il: Int) -> Bool {
  current_il <= max_il
}

/// Validate that the owner signed the transaction
fn signed_by_owner(owner: ByteArray, signatories: List<ByteArray>) -> Bool {
  list.has(signatories, owner)
}

validator {
  fn vault_validator(
    datum: VaultDatum, 
    redeemer: VaultRedeemer, 
    context: ScriptContext
  ) -> Bool {
    
    expect Spend(own_ref) = context.purpose
    expect Some(own_input) = list.find(context.transaction.inputs, fn(input) { input.output_reference == own_ref })
    expect Some(own_output) = list.at(context.transaction.outputs, 0)
    
    let VaultDatum {
      owner,
      policy,
      lp_asset,
      deposit_amount,
      deposit_time,
      initial_pool_state: _,
    } = datum
    
    let UserPolicy {
      max_il_percent,
      deposit_ratio: _,
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
        
        valid_signature && valid_amount && correct_deposit
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
        
        valid_signature && valid_amount && il_check && correct_withdrawal
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
        
        valid_signature && valid_policy && lp_unchanged
      }
      
      // Emergency exit - withdraw all funds regardless of IL
      EmergencyExit -> {
        let valid_signature = signed_by_owner
        let emergency_enabled = emergency_withdraw
        
        // All LP tokens should be withdrawn
        let input_lp_amount = quantity_of(own_input.output.value, lp_asset.policy_id, lp_asset.token_name)
        
        valid_signature && emergency_enabled && input_lp_amount > 0
      }
    }
  }
}