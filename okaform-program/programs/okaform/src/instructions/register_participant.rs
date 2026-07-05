use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::*;
use crate::state::*;


// The RegisterParticipant struct defines the accounts needed to register a respondent for a survey.
// The respondent account serves three purposes:

// 1. Signer (Signer<'info>) — proves the wallet is authorizing this registration
// 2. Payer (payer = respondent) — pays the rent for creating the new participant PDA account
// 3. Identity — its pubkey is used as a seed to derive the participant PDA 
// ([PARTICIPANT_SEED, survey.key(), respondent.key()]) and
// stored in the participant entry (participant.respondent = ctx.accounts.respondent.key())

// In short, it's the wallet registering to participate in the survey — it signs the transaction,
// pays for account creation, and gets recorded as the participant identity on-chain.

// #[derive(Accounts)]
// pub struct RegisterParticipant<'info> {
//     #[account(mut)]
//     pub survey: Account<'info, SurveyAccount>,

//     #[account(
//         init,
//         payer = respondent,
//         space = 8 + ParticipantEntry::INIT_SPACE,
//         seeds = [PARTICIPANT_SEED, survey.key().as_ref(), respondent.key().as_ref()],
//         bump
//     )]
//     pub participant: Account<'info, ParticipantEntry>,

//     #[account(mut)]
//     pub respondent: Signer<'info>,

//     pub system_program: Program<'info, System>,
// }

#[derive(Accounts)]
#[instruction(survey_id: Vec<u8>)]
pub struct RegisterParticipant<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,  // creator signs + pays

    #[account(
        mut,
        seeds = [SURVEY_SEED, creator.key().as_ref(), survey_id.as_ref()],
        bump = survey.bump,
        has_one = creator
    )]
    pub survey: Account<'info, SurveyAccount>,

    #[account(
        init,
        payer = creator,  // creator pays rent, not respondent
        space = 8 + ParticipantEntry::INIT_SPACE,
        seeds = [PARTICIPANT_SEED, survey.key().as_ref(), respondent.key().as_ref()],
        bump
    )]
    pub participant: Account<'info, ParticipantEntry>,

    /// CHECK: Read-only — used as PDA seed and recorded as identity
    pub respondent: AccountInfo<'info>,  // no longer a Signer or payer

    pub system_program: Program<'info, System>,
}


pub fn process_register_participant(
    ctx: Context<RegisterParticipant>,
    _survey_id: Vec<u8>,
) -> Result<()> {
    
    let survey: &mut Account<'_, SurveyAccount> = &mut ctx.accounts.survey;
     
    require!(survey.is_active, OkaformError::SurveyNotActive);
    require!(
        survey.response_count < survey.max_responses,
        OkaformError::MaxResponsesReached
    );

    let participant: &mut Account<'_, ParticipantEntry> = &mut ctx.accounts.participant;
    participant.survey = survey.key();
    participant.respondent = ctx.accounts.respondent.key();
    participant.has_submitted = false;
    participant.score_weight = 0;
    participant.bump = ctx.bumps.participant;

    survey.response_count += 1;

    msg!("Participant registered for survey");
    Ok(())
}
