use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct DistributeRewards<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [SURVEY_SEED, creator.key().as_ref(), survey_id.as_ref()],
        bump = survey.bump,
        has_one = creator @ OkaformError::Unauthorized
    )]
    pub survey: Account<'info, SurveyAccount>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, survey.key().as_ref()],
        bump
    )]
    /// CHECK: Escrow vault PDA, holds SOL for distribution
    pub escrow_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_distribute_rewards(
    ctx: Context<DistributeRewards>,
    _survey_id: Vec<u8>,
    amounts: Vec<u64>,
) -> Result<()> {
    let survey: &Account<'_, SurveyAccount> = &ctx.accounts.survey;

    require!(!survey.is_active, OkaformError::SurveyNotActive);
    require_gt!(survey.response_count, 0, OkaformError::NoParticipants);

    let participants = ctx.remaining_accounts;

    require!(!participants.is_empty(), OkaformError::NoParticipants);
    require_eq!(
        participants.len(),
        amounts.len(),
        OkaformError::InvalidRewardType
    );

    let escrow_lamports: u64 = ctx.accounts.escrow_vault.lamports();
    let mut distributed: u64 = 0; // Track total amount of lamports distributed

    for (wallet_info, amount) in participants.iter().zip(amounts.iter()) {
        if *amount == 0 || escrow_lamports < (distributed + *amount) {
            continue;
        }

        **ctx.accounts.escrow_vault.try_borrow_mut_lamports()? -= *amount;
        **wallet_info.try_borrow_mut_lamports()? += *amount;

        distributed += *amount;
        msg!("Distributed {} lamports to {}", *amount, wallet_info.key());
    }

    msg!("Rewards distributed: {} total lamports", distributed);
    Ok(())
}
