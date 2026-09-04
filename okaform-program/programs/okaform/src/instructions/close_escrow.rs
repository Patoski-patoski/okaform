use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct CloseEscrow<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

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
    /// CHECK: Escrow vault PDA holding SOL for distribution, closed after payout
    pub escrow_vault: AccountInfo<'info>,

    /// CHECK: Survey creator receives the remaining escrow balance (rent buffer)
    #[account(mut, address = survey.creator)]
    pub beneficiary: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_close_escrow(ctx: Context<CloseEscrow>, _survey_id: Vec<u8>) -> Result<()> {
    let survey = &ctx.accounts.survey;
    let signer = &ctx.accounts.signer;

    // Allow either the creator OR the backend authority to close the escrow
    let is_creator = signer.key() == survey.creator;
    let is_authority = signer.key() == authority::ID;

    require!(
        is_creator || is_authority,
        OkaformError::Unauthorized
    );

    require!(!survey.is_active, OkaformError::SurveyNotActive);

    let escrow_lamports: u64 = ctx.accounts.escrow_vault.lamports();
    require!(escrow_lamports > 0, OkaformError::EscrowAlreadyClosed);

    **ctx.accounts.escrow_vault.try_borrow_mut_lamports()? -= escrow_lamports;
    **ctx.accounts.beneficiary.try_borrow_mut_lamports()? += escrow_lamports;

    msg!(
        "Escrow closed, swept {} lamports to {}",
        escrow_lamports,
        ctx.accounts.beneficiary.key()
    );
    Ok(())
}
