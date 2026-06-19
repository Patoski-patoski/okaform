use anchor_lang::prelude::*;

declare_id!("2qJF3VgV2E9rHPs8gmcEiAiWr1SvKQZsP6QFdy1h4Dw3");

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;
use state::*;

#[program]
pub mod formchain_program {
    use super::*;

    pub fn initialize_survey(
        ctx: Context<InitializeSurvey>,
        survey_id: Vec<u8>,
        reward_pool: u64,
        reward_type: RewardType,
        max_responses: u32,
    ) -> Result<()> {
        process_initialize_survey(ctx, survey_id, reward_pool, reward_type, max_responses)
    }

    pub fn register_participant(ctx: Context<RegisterParticipant>) -> Result<()> {
        process_register_participant(ctx)
    }

    pub fn initialize_score_account(ctx: Context<InitializeScoreAccount>) -> Result<()> {
        process_initialize_score_account(ctx)
    }

    pub fn update_score(ctx: Context<UpdateScore>, delta: i32) -> Result<()> {
        process_update_score(ctx, delta)
    }

    pub fn close_survey(ctx: Context<CloseSurvey>, survey_id: Vec<u8>) -> Result<()> {
        process_close_survey(ctx, survey_id)
    }

    pub fn distribute_rewards(
        ctx: Context<DistributeRewards>,
        survey_id: Vec<u8>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        process_distribute_rewards(ctx, survey_id, amounts)
    }
}
