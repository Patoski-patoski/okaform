use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct CloseSurvey<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [SURVEY_SEED, survey.creator.key().as_ref(), survey_id.as_ref()],
        bump = survey.bump,
    )]
    pub survey: Account<'info, SurveyAccount>,
}

pub fn process_close_survey(ctx: Context<CloseSurvey>, _survey_id: Vec<u8>) -> Result<()> {
    let survey = &mut ctx.accounts.survey;
    let signer = &ctx.accounts.signer;

    // Allow either the creator OR the authority to close the survey
    let is_creator = signer.key() == survey.creator;
    let is_authority = signer.key() == authority::ID;

    require!(
        is_creator || is_authority,
        OkaformError::Unauthorized
    );

    require!(survey.is_active, OkaformError::SurveyAlreadyClosed);

    survey.is_active = false;

    msg!("Survey closed by {}", if is_creator { "creator" } else { "authority" });
    Ok(())
}
