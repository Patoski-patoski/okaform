use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct CloseSurvey<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [SURVEY_SEED, creator.key().as_ref(), survey_id.as_ref()],
        bump = survey.bump,
        has_one = creator @ OkaformError::Unauthorized
    )]
    pub survey: Account<'info, SurveyAccount>,
}

pub fn process_close_survey(ctx: Context<CloseSurvey>, _survey_id: Vec<u8>) -> Result<()> {
    let survey = &mut ctx.accounts.survey;
    require!(survey.is_active, OkaformError::SurveyAlreadyClosed);

    survey.is_active = false;

    msg!("Survey closed by creator");
    Ok(())
}
