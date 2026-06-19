use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
pub struct UpdateScore<'info> {
    #[account(
        mut,
        constraint = authority.key() == crate::constants::authority::ID @ FormchainError::Unauthorized
        )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [SCORE_SEED, wallet.key().as_ref()],
        bump = score_account.bump,
        has_one = wallet
    )]
    pub score_account: Account<'info, RespondentScoreAccount>,

    /// CHECK: Read-only wallet used as PDA seed
    pub wallet: AccountInfo<'info>,
}

pub fn process_update_score(ctx: Context<UpdateScore>, delta: i32) -> Result<()> {
    let score_account = &mut ctx.accounts.score_account;

    let new_score = if delta >= 0 {
        score_account.global_score.saturating_add(delta as u16)
    } else {
        score_account.global_score.saturating_sub(delta.unsigned_abs() as u16)
    };

    score_account.global_score = new_score;
    score_account.badge_tier = BadgeTier::from_score(new_score);
    score_account.surveys_completed = score_account.surveys_completed.saturating_add(1);

    msg!(
        "Score updated: delta={}, new_score={}, tier={:?}, surveys={}",
        delta,
        score_account.global_score,
        score_account.badge_tier,
        score_account.surveys_completed
    );
    Ok(())
}
