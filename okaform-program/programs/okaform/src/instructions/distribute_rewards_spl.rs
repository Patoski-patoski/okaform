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
/// Remaining accounts must be passed in pairs for each recipient:
/// [recipient_wallet_0, recipient_ata_0, recipient_wallet_1, recipient_ata_1, ...]
/// Each entry in `amounts` corresponds to a recipient pair.
pub fn process_distribute_rewards_spl<'a>(
    ctx: Context<'_, '_, 'a, 'a, DistributeRewardsSpl<'a>>,
    _survey_id: Vec<u8>,
    amounts: Vec<u64>,
) -> Result<()> {
    let survey = &mut ctx.accounts.survey;
    let remaining = ctx.remaining_accounts;

    require!(!amounts.is_empty(), OkaformError::NoParticipants);
    require_eq!(
        remaining.len(),
        amounts.len() * 2,
        OkaformError::InvalidRewardType
    );

    let escrow_balance = ctx.accounts.escrow_vault.amount;
    let mut distributed: u64 = 0;

    // Build PDA signer seeds for the escrow vault
    let survey_key = survey.key();
    let bump = survey.escrow_vault_bump;
    let seeds: &[&[u8]] = &[TOKEN_ESCROW_SEED, survey_key.as_ref(), &[bump]];
    let signer_seeds = &[seeds];

    for (i, amount) in amounts.iter().enumerate() {
        if *amount == 0 || escrow_balance < (distributed + *amount) {
            continue;
        }

        let wallet_info = &remaining[i * 2];
        let ata_info = &remaining[i * 2 + 1];

        // 1. Participant wallet cannot be the survey creator
        require!(
            wallet_info.key() != survey.creator,
            OkaformError::CreatorCannotBeRespondent
        );

        // 2. Validate that ata_info is the canonical Associated Token Account for (wallet, survey.token_mint)
        let expected_ata = anchor_spl::associated_token::get_associated_token_address(
            &wallet_info.key(),
            &survey.token_mint,
        );
        require_keys_eq!(
            ata_info.key(),
            expected_ata,
            OkaformError::InvalidTokenAccount
        );

        // 3. Deserialize ata_info to verify it is an initialized TokenAccount with matching owner and mint
        let token_account =
            anchor_spl::token::TokenAccount::try_deserialize(&mut &ata_info.data.borrow()[..])?;
        require_keys_eq!(
            token_account.owner,
            wallet_info.key(),
            OkaformError::Unauthorized
        );
        require_keys_eq!(
            token_account.mint,
            survey.token_mint,
            OkaformError::TokenMintMismatch
        );

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_vault.to_account_info(),
                to: ata_info.clone(),
                authority: ctx.accounts.escrow_vault.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, *amount)?;

        distributed += *amount;
        msg!(
            "Distributed {} tokens to recipient {} (ATA: {})",
            *amount,
            wallet_info.key(),
            ata_info.key()
        );
    }

    survey.is_active = false;
    msg!("SPL rewards distributed: {} total tokens", distributed);
    Ok(())
}
