use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct InitializeSurveySpl<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 + SurveyAccount::INIT_SPACE,
        seeds = [SURVEY_SEED, signer.key().as_ref(), survey_id.as_ref()],
        bump
    )]
    pub survey: Account<'info, SurveyAccount>,

    /// The SPL token mint for the reward (must have 6 decimals, e.g. USDC)
    #[account(
        constraint = reward_mint.decimals == 6 @ OkaformError::InvalidTokenDecimals
    )]
    pub reward_mint: Account<'info, Mint>,

    /// PDA-owned token account that holds the escrowed SPL tokens
    #[account(
        init,
        payer = signer,
        seeds = [TOKEN_ESCROW_SEED, survey.key().as_ref()],
        bump,
        token::mint = reward_mint,
        token::authority = escrow_vault,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// Creator's token account (ATA) for the reward mint
    #[account(
        mut,
        constraint = creator_token_account.mint == reward_mint.key() @ OkaformError::TokenMintMismatch,
        constraint = creator_token_account.owner == signer.key() @ OkaformError::Unauthorized,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn process_initialize_survey_spl(
    ctx: Context<InitializeSurveySpl>,
    _survey_id: Vec<u8>,
    reward_pool: u64,
    reward_type: RewardType,
    max_responses: u32,
) -> Result<()> {
    require!(
        reward_pool >= MIN_REWARD_POOL_SPL,
        OkaformError::InsufficientRewardPool
    );
    require!(
        reward_pool <= MAX_REWARD_POOL_SPL,
        OkaformError::ExcessiveRewardPool
    );

    let survey = &mut ctx.accounts.survey;
    let signer = &ctx.accounts.signer;

    survey.creator = signer.key();
    survey.reward_pool = reward_pool;
    survey.reward_type = reward_type;
    survey.max_responses = max_responses;
    survey.response_count = 0;
    survey.is_active = true;
    survey.bump = ctx.bumps.survey;
    survey.token_mint = ctx.accounts.reward_mint.key();
    survey.escrow_vault_bump = ctx.bumps.escrow_vault;

    // Transfer SPL tokens from creator to escrow vault
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.creator_token_account.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, reward_pool)?;

    msg!(
        "SPL survey initialized with {} tokens escrowed (mint: {})",
        reward_pool,
        ctx.accounts.reward_mint.key()
    );
    Ok(())
}
