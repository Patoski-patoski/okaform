use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;

pub fn process_register_participant(ctx: Context<RegisterParticipant>) -> Result<()> {
    let survey = &mut ctx.accounts.survey;
    require!(survey.is_active, FormchainError::SurveyNotActive);
    require!(
        survey.response_count < survey.max_responses,
        FormchainError::MaxResponsesReached
    );

    let participant = &mut ctx.accounts.participant;
    participant.survey = survey.key();
    participant.respondent = ctx.accounts.respondent.key();
    participant.has_submitted = false;
    participant.score_weight = 0;
    participant.bump = ctx.bumps.participant;

    survey.response_count += 1;

    msg!("Participant registered for survey");
    Ok(())
}

#[derive(Accounts)]
pub struct RegisterParticipant<'info> {
    #[account(mut)]
    pub survey: Account<'info, SurveyAccount>,

    #[account(
        init,
        payer = respondent,
        space = 8 + ParticipantEntry::INIT_SPACE,
        seeds = [PARTICIPANT_SEED, survey.key().as_ref(), respondent.key().as_ref()],
        bump
    )]
    pub participant: Account<'info, ParticipantEntry>,

    #[account(mut)]
    pub respondent: Signer<'info>,

    pub system_program: Program<'info, System>,
}
