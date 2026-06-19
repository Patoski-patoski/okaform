use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ParticipantEntry {
    pub survey: Pubkey,
    pub respondent: Pubkey,
    pub has_submitted: bool,
    pub score_weight: u8,
    pub bump: u8,
}
