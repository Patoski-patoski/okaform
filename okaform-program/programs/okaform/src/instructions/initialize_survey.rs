use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

// The InitializeSurvey struct defines the accounts needed to initialize a new survey on-chain.

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct InitializeSurvey<'info> {
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

    #[account(
        init,
        payer = signer,
        space = 0,
        seeds = [ESCROW_SEED, survey.key().as_ref()],
        bump
    )]
    /// CHECK: This is a PDA used as an escrow vault, no data stored
    pub escrow_vault: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn process_initialize_survey(
    ctx: Context<InitializeSurvey>,
    _survey_id: Vec<u8>,
    reward_pool: u64,
    reward_type: RewardType,
    max_responses: u32,
) -> Result<()> {
    require!(
        reward_pool >= MIN_REWARD_POOL,
        OkaformError::InsufficientRewardPool
    );
    require!(
        reward_pool <= MAX_REWARD_POOL,
        OkaformError::ExcessiveRewardPool
    );

    let survey: &mut Account<'_, SurveyAccount> = &mut ctx.accounts.survey;
    let signer = &ctx.accounts.signer;

    // Store the signer as the creator (can be either the user or the backend authority)
    survey.creator = signer.key();
    survey.reward_pool = reward_pool;
    survey.reward_type = reward_type;
    survey.max_responses = max_responses;
    survey.response_count = 0;
    survey.is_active = true;
    survey.bump = ctx.bumps.survey;
    survey.token_mint = Pubkey::default(); // native SOL marker
    survey.escrow_vault_bump = 0;          // unused for SOL

    let ix = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.signer.key(),
        &ctx.accounts.escrow_vault.key(),
        reward_pool,
    );
    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            ctx.accounts.signer.to_account_info(),
            ctx.accounts.escrow_vault.to_account_info(),
        ],
    )?;

    msg!("Survey initialized with {} lamports escrowed", reward_pool);
    Ok(())
}
