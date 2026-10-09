use core::ops::Mul;

/// Derived `Ord` follows the explicit discriminants, so `Negative < Positive`.
#[repr(i8)]
#[derive(PartialEq, Eq, PartialOrd, Ord, Debug, Clone, Copy)]
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

/// The sign of a product or a quotient: `Positive` iff the signs agree.
impl Mul for Sign {
    type Output = Self;

    fn mul(self, rhs: Self) -> Self {
        if self == rhs {
            Self::Positive
        } else {
            Self::Negative
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Sign::{Negative, Positive};

    #[test]
    fn flip() {
        assert_eq!(Positive.flip(), Negative);
        assert_eq!(Negative.flip(), Positive);
    }

    #[test]
    fn mul() {
        assert_eq!(Positive * Positive, Positive);
        assert_eq!(Positive * Negative, Negative);
        assert_eq!(Negative * Positive, Negative);
        assert_eq!(Negative * Negative, Positive);
    }

    #[test]
    fn negative_is_less_than_positive() {
        assert!(Negative < Positive);
    }
}
