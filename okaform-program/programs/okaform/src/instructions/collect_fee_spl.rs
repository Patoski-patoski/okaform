use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct CollectFeeSpl<'info> {
    /// Protocol authority — only the hardcoded authority can collect fees
    #[account(
        mut,
        constraint = authority.key() == crate::constants::authority::ID @ OkaformError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [SURVEY_SEED, survey.creator.key().as_ref(), survey_id.as_ref()],
        bump = survey.bump,
        constraint = survey.token_mint != Pubkey::default() @ OkaformError::InvalidTokenMint,
    )]
    pub survey: Account<'info, SurveyAccount>,

    /// Escrow token account holding SPL tokens
    #[account(
        mut,
        seeds = [TOKEN_ESCROW_SEED, survey.key().as_ref()],
        bump = survey.escrow_vault_bump,
        token::mint = survey.token_mint,
        token::authority = escrow_vault,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// Protocol treasury's token account for the reward mint
    #[account(
        mut,
        constraint = fee_token_account.mint == survey.token_mint @ OkaformError::TokenMintMismatch,
    )]
    pub fee_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn process_collect_fee_spl(
    ctx: Context<CollectFeeSpl>,
    _survey_id: Vec<u8>,
    fee_amount: u64,
) -> Result<()> {
    if fee_amount == 0 {
        msg!("Protocol fee is zero, skipping");
        return Ok(());
    }

    let escrow_balance = ctx.accounts.escrow_vault.amount;
    require!(
        escrow_balance >= fee_amount,
        OkaformError::InsufficientTokenBalance
    );

    let survey_key = ctx.accounts.survey.key();
    let bump = ctx.accounts.survey.escrow_vault_bump;
    let seeds: &[&[u8]] = &[TOKEN_ESCROW_SEED, survey_key.as_ref(), &[bump]];
    let signer_seeds = &[seeds];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.fee_token_account.to_account_info(),
            authority: ctx.accounts.escrow_vault.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, fee_amount)?;

    msg!(
        "Collected {} tokens protocol fee to {}",
        fee_amount,
        ctx.accounts.fee_token_account.key()
    );
    Ok(())
}
