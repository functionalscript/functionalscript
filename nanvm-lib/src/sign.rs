#[repr(i8)]
#[derive(PartialEq, Debug, Clone, Copy)]
pub enum Sign {
    Positive = 1,
    Negative = -1,
}

impl Sign {
    pub const fn flip(self) -> Self {
        match self {
            Self::Positive => Self::Negative,
            Self::Negative => Self::Positive,
        }
    }
}
