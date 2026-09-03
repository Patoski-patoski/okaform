use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct DistributeRewardsSpl<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [SURVEY_SEED, creator.key().as_ref(), survey_id.as_ref()],
        bump = survey.bump,
        has_one = creator @ OkaformError::Unauthorized,
        constraint = survey.token_mint != Pubkey::default() @ OkaformError::InvalidTokenMint,
    )]
    pub survey: Account<'info, SurveyAccount>,

    /// Escrow token account holding SPL tokens for distribution
    #[account(
        mut,
        seeds = [TOKEN_ESCROW_SEED, survey.key().as_ref()],
        bump = survey.escrow_vault_bump,
        token::mint = survey.token_mint,
        token::authority = escrow_vault,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Distributes SPL token rewards to participant ATAs passed via remaining_accounts.
/// Each entry in `amounts` corresponds to a recipient ATA in `remaining_accounts`.
pub fn process_distribute_rewards_spl<'a>(
    ctx: Context<'_, '_, 'a, 'a, DistributeRewardsSpl<'a>>,
    _survey_id: Vec<u8>,
    amounts: Vec<u64>,
) -> Result<()> {
    let survey = &mut ctx.accounts.survey;
    let participants = ctx.remaining_accounts;

    require!(!participants.is_empty(), OkaformError::NoParticipants);
    require_eq!(
        participants.len(),
        amounts.len(),
        OkaformError::InvalidRewardType
    );

    let escrow_balance = ctx.accounts.escrow_vault.amount;
    let mut distributed: u64 = 0;

    // Build PDA signer seeds for the escrow vault
    let survey_key = survey.key();
    let bump = survey.escrow_vault_bump;
    let seeds: &[&[u8]] = &[TOKEN_ESCROW_SEED, survey_key.as_ref(), &[bump]];
    let signer_seeds = &[seeds];

    for (recipient_ata_info, amount) in participants.iter().zip(amounts.iter()) {
        if *amount == 0 || escrow_balance < (distributed + *amount) {
            continue;
        }

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: recipient_ata_info.clone(),
                authority: ctx.accounts.escrow_vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, *amount)?;

        distributed += *amount;
        msg!("Distributed {} tokens to {}", *amount, recipient_ata_info.key());
    }

    survey.is_active = false;
    msg!("SPL rewards distributed: {} total tokens", distributed);
    Ok(())
}
