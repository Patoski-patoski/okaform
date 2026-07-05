use anchor_lang::prelude::*;

use crate::state::BadgeTier;

#[account]
#[derive(InitSpace)]
pub struct RespondentScoreAccount {
    pub wallet: Pubkey,
    pub global_score: u16,
    pub surveys_completed: u32,
    pub badge_tier: BadgeTier,
    pub bump: u8,
}
