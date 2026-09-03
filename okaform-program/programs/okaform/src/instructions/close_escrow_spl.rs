use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct CloseEscrowSpl<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [SURVEY_SEED, survey.creator.key().as_ref(), survey_id.as_ref()],
        bump = survey.bump,
        constraint = survey.token_mint != Pubkey::default() @ OkaformError::InvalidTokenMint,
    )]
    pub survey: Account<'info, SurveyAccount>,

    /// Escrow token account to be closed
    #[account(
        mut,
        seeds = [TOKEN_ESCROW_SEED, survey.key().as_ref()],
        bump = survey.escrow_vault_bump,
        token::mint = survey.token_mint,
        token::authority = escrow_vault,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// Creator's token account — receives any remaining SPL tokens
    #[account(
        mut,
        constraint = creator_token_account.mint == survey.token_mint @ OkaformError::TokenMintMismatch,
        constraint = creator_token_account.owner == survey.creator @ OkaformError::Unauthorized,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// CHECK: Survey creator receives the rent lamports from closing the token account
    #[account(mut, address = survey.creator)]
    pub beneficiary: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn process_close_escrow_spl(ctx: Context<CloseEscrowSpl>, _survey_id: Vec<u8>) -> Result<()> {
    let survey = &ctx.accounts.survey;
    let signer = &ctx.accounts.signer;

    // Allow either the creator OR the backend authority to close the escrow
    let is_creator = signer.key() == survey.creator;
    let is_authority = signer.key() == authority::ID;

    require!(is_creator || is_authority, OkaformError::Unauthorized);
    require!(!survey.is_active, OkaformError::SurveyNotActive);

    let survey_key = survey.key();
    let bump = survey.escrow_vault_bump;
    let seeds: &[&[u8]] = &[TOKEN_ESCROW_SEED, survey_key.as_ref(), &[bump]];
    let signer_seeds = &[seeds];

    // Sweep any remaining tokens back to creator's ATA
    let remaining_tokens = ctx.accounts.escrow_vault.amount;
    if remaining_tokens > 0 {
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.escrow_vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, remaining_tokens)?;
    }

    // Close the token account, refunding rent SOL to the creator (beneficiary)
    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.escrow_vault.to_account_info(),
            destination: ctx.accounts.beneficiary.to_account_info(),
            authority: ctx.accounts.escrow_vault.to_account_info(),
        },
        signer_seeds,
    );
    token::close_account(close_ctx)?;

    msg!(
        "SPL escrow closed — swept {} tokens and rent to {}",
        remaining_tokens,
        ctx.accounts.beneficiary.key()
    );
    Ok(())
}
