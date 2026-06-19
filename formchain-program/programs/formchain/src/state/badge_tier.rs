use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum BadgeTier {
    Grey,
    Blue,
    Green,
    Gold,
    Diamond,
}

impl BadgeTier {
    pub fn from_score(score: u16) -> Self {
        match score {
            0..=25 => BadgeTier::Grey,
            26..=50 => BadgeTier::Blue,
            51..=75 => BadgeTier::Green,
            76..=100 => BadgeTier::Gold,
            _ => BadgeTier::Diamond,
        }
    }

    pub fn weight(&self) -> u8 {
        match self {
            BadgeTier::Grey => 50,
            BadgeTier::Blue => 75,
            BadgeTier::Green => 100,
            BadgeTier::Gold => 125,
            BadgeTier::Diamond => 150,
        }
    }
}
