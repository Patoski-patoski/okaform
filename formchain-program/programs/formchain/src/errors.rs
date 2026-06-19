use anchor_lang::prelude::*;

#[error_code]
pub enum FormchainError {
    #[msg("Survey is not active")]
    SurveyNotActive,
    #[msg("Survey is already closed")]
    SurveyAlreadyClosed,
    #[msg("Maximum responses reached")]
    MaxResponsesReached,
    #[msg("Already submitted")]
    AlreadySubmitted,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Insufficient reward pool")]
    InsufficientRewardPool,
    #[msg("Excessive reward pool")]
    ExcessiveRewardPool,
    #[msg("No participants to distribute")]
    NoParticipants,
    #[msg("Invalid reward type")]
    InvalidRewardType,
}
