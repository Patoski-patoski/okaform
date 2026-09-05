use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

// InitializeScoreAccount creates a wallet-level reputation profile — a persistent on-chain identity that tracks
// a user's participation history across all surveys.

// The score_account (a RespondentScoreAccount PDA)
// - PDA seeds: [SCORE_SEED, wallet.key()] — derived solely from the wallet, so it's global (one per wallet, not per survey)
// - Fields tracked:
// - global_score — cumulative reputation score
// - surveys_completed — lifetime count
// - badge_tier — reputation level (Ghost → higher tiers)

// The score_account is the foundation for the reputation system.
// When update_score runs after survey completion, it modifies this global account — incrementing surveys_completed,
// adjusting global_score, and upgrading badge_tier based on accumulated score.
// This creates a Sybil-resistant incentive: wallet history is transparent and harder to fake,
// since high-reputation wallets have a track record of consistent participation.

// The authority (protocol authority keypair) pays the rent for account creation so respondents
// never need to hold SOL or approve a transaction just to participate in a survey.
// The wallet field is a read-only AccountInfo — it is only used as a PDA seed and to set
// score_account.wallet; it does NOT need to sign.

#[derive(Accounts)]
pub struct InitializeScoreAccount<'info> {
    /// Protocol authority — signs and pays the rent for account creation.
    #[account(
        mut,
        constraint = authority.key() == crate::constants::authority::ID @ OkaformError::Unauthorized
    )]
    pub authority: Signer<'info>,

    /// CHECK: Read-only; used only as a PDA seed and to record which wallet
    /// this score account belongs to. No ownership or signature check needed.
    pub wallet: AccountInfo<'info>,

    #[account(
        init, // creates the account
        payer = authority, // protocol authority pays the rent
        space = 8 + RespondentScoreAccount::INIT_SPACE,
        seeds = [SCORE_SEED, wallet.key().as_ref()], // still derived from the respondent wallet
        bump
    )]
    pub score_account: Account<'info, RespondentScoreAccount>,

    pub system_program: Program<'info, System>,
}

pub fn process_initialize_score_account(ctx: Context<InitializeScoreAccount>) -> Result<()> {
    let score_account: &mut Account<'_, RespondentScoreAccount> = &mut ctx.accounts.score_account;
    score_account.wallet = ctx.accounts.wallet.key(); // the respondent's public key
    score_account.global_score = 0;
    score_account.surveys_completed = 0;
    score_account.badge_tier = BadgeTier::Ghost;
    score_account.bump = ctx.bumps.score_account;

    msg!("Score account initialized for wallet: {:?}", ctx.accounts.wallet.key());
    Ok(())
}