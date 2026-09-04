pub const SURVEY_SEED: &[u8] = b"survey";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const PARTICIPANT_SEED: &[u8] = b"participant";
pub const SCORE_SEED: &[u8] = b"score";
pub const TOKEN_ESCROW_SEED: &[u8] = b"token_escrow";

pub const MAX_REWARD_POOL: u64 = 1_000_000_000_000; // 1000 SOL in lamports
pub const MIN_REWARD_POOL: u64 = 100_000_000; // 0.1 SOL in lamports

// SPL token bounds (6-decimal scale for USDC: 1 USDC = 1_000_000 base units)
pub const MIN_REWARD_POOL_SPL: u64 = 1_000_000;       // 1 USDC
pub const MAX_REWARD_POOL_SPL: u64 = 10_000_000_000;  // 10,000 USDC

use anchor_lang::prelude::*;

pub mod authority {
    use super::*;

    pub const ID: Pubkey = Pubkey::new_from_array([
        214, 34, 12, 77, 222, 61, 202, 75, 38, 138, 21, 105, 187, 153, 157, 216,
        154, 56, 205, 82, 153, 53, 32, 237, 127, 246, 128, 205, 114, 49, 43, 197,
    ]);
}
