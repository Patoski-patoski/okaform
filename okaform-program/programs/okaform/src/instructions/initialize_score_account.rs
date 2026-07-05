use anchor_lang::prelude::*;

use crate::constants::*;
use crate::state::*;

// InitializeScoreAccount creates a wallet-level reputation profile — a persistent on-chain identity that tracks
// a user's participation history across all surveys.

// The score_account (a RespondentScoreAccount PDA)
// - PDA seeds: [SCORE_SEED, wallet.key()] — derived solely from the wallet, so it's global (one per wallet, not per survey)
// - Fields tracked:
// - global_score — cumulative reputation score
// - surveys_completed — lifetime count
// - badge_tier — reputation level (Grey → higher tiers)

// The score_account is the foundation for the reputation system.
// When update_score runs after survey completion, it modifies this global account — incrementing surveys_completed, 
// adjusting global_score, and upgrading badge_tier based on accumulated score. 
// This creates a Sybil-resistant incentive: wallet history is transparent and harder to fake, 
// since high-reputation wallets have a track record of consistent participation.

#[derive(Accounts)]
pub struct InitializeScoreAccount<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>, // the account that pays

    #[account(
        init, // creates the account
        payer = wallet, // who pays
        space = 8 + RespondentScoreAccount::INIT_SPACE, // allocates space
        seeds = [SCORE_SEED, wallet.key().as_ref()], // seeds
        bump // For PDA derivation
    )]
    pub score_account: Account<'info, RespondentScoreAccount>, // the account to be initialized

    pub system_program: Program<'info, System>, // required for init
}


pub fn process_initialize_score_account(ctx: Context<InitializeScoreAccount>) -> Result<()> {
    let score_account: &mut Account<'_, RespondentScoreAccount> = &mut ctx.accounts.score_account;
    score_account.wallet = ctx.accounts.wallet.key(); // set the wallet field to the wallet's public key
    score_account.global_score = 0; // initialize the global score to 0
    score_account.surveys_completed = 0; // initialize the surveys completed to 0
    score_account.badge_tier = BadgeTier::Grey; // initialize the badge tier to Grey
    score_account.bump = ctx.bumps.score_account; // set the bump for PDA derivation

    msg!("Score account initialized");
    Ok(())
}