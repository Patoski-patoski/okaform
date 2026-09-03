use anchor_lang::prelude::*;

use crate::state::RewardType;

#[account]
#[derive(InitSpace)]
pub struct SurveyAccount {
    pub creator: Pubkey,
    pub reward_pool: u64,
    pub reward_type: RewardType,
    pub max_responses: u32,
    pub response_count: u32,
    pub is_active: bool,
    pub bump: u8,
    /// Pubkey::default() = native SOL survey; non-zero = SPL token mint
    pub token_mint: Pubkey,
    /// PDA bump for the token escrow account (only used for SPL surveys)
    pub escrow_vault_bump: u8,
}
