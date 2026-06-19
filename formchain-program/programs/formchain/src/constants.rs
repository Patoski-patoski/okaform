pub const SURVEY_SEED: &[u8] = b"survey";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const PARTICIPANT_SEED: &[u8] = b"participant";
pub const SCORE_SEED: &[u8] = b"score";

pub const MAX_REWARD_POOL: u64 = 1_000_000_000_000; // 1000 SOL in lamports
pub const MIN_REWARD_POOL: u64 = 100_000_000; // 0.1 SOL in lamports

use anchor_lang::prelude::*;

pub mod authority {
    use super::*;

    declare_id!("FQtMrhPXc6taxXPvMZGjqUDKuDwneBZZX4XdCFFtALWp");
}