use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct CollectFee<'info> {
    #[account(
        mut,
        constraint = authority.key() == crate::constants::authority::ID @ OkaformError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [SURVEY_SEED, survey.creator.key().as_ref(), survey_id.as_ref()],
        bump = survey.bump,
    )]
    pub survey: Account<'info, SurveyAccount>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, survey.key().as_ref()],
        bump
    )]
    /// CHECK: Escrow vault PDA holding SOL, fee is taken from this
    pub escrow_vault: AccountInfo<'info>,

    /// CHECK: Protocol treasury wallet receiving the fee
    #[account(mut)]
    pub fee_wallet: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_collect_fee(
    ctx: Context<CollectFee>,
    _survey_id: Vec<u8>,
    fee_lamports: u64,
) -> Result<()> {
    if fee_lamports == 0 {
        msg!("Protocol fee is zero, skipping");
        return Ok(());
    }

    let escrow_lamports: u64 = ctx.accounts.escrow_vault.lamports();
    require!(
        escrow_lamports >= fee_lamports,
        OkaformError::InsufficientRewardPool
    );

    **ctx.accounts.escrow_vault.try_borrow_mut_lamports()? -= fee_lamports;
    **ctx.accounts.fee_wallet.try_borrow_mut_lamports()? += fee_lamports;

    msg!(
        "Collected {} lamports protocol fee to {}",
        fee_lamports,
        ctx.accounts.fee_wallet.key()
    );
    Ok(())
}
