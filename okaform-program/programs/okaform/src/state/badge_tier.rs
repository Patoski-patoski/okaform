use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum BadgeTier {
    Ghost,
    Cipher,
    Sentinel,
    Oracle,
    Sovereign,
}

impl BadgeTier {
    pub fn from_score(score: u16) -> Self {
        match score {
            0..=25 => BadgeTier::Ghost,
            26..=50 => BadgeTier::Cipher,
            51..=75 => BadgeTier::Sentinel,
            76..=100 => BadgeTier::Oracle,
            _ => BadgeTier::Sovereign,
        }
    }

    pub fn weight(&self) -> u8 {
        match self {
            BadgeTier::Ghost => 50,
            BadgeTier::Cipher => 75,
            BadgeTier::Sentinel => 100,
            BadgeTier::Oracle => 125,
            BadgeTier::Sovereign => 150,
        }
    }
}
