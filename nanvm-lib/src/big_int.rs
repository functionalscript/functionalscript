use crate::{
    big_uint::BigUint,
    interface::{Any, Complex, Container},
    sign::Sign,
};

pub trait BigInt<U: Any<BigInt = Self>>: Complex<U> + Container<Header = Sign, Item = u64> {
    fn is_zero(&self) -> bool {
        self.items().is_empty()
    }
    fn zero() -> Self {
        Self::new(Sign::Positive, [])
    }
    fn negate(self) -> Self {
        match self.header() {
            Sign::Positive => Self::new(Sign::Negative, self.items().iter().cloned()),
            Sign::Negative => Self::new(Sign::Positive, self.items().iter().cloned()),
        }
    }
    fn mul(self, other: Self) -> Self {
        let uint_result = BigUint::mul(self.items(), other.items());
        if *self.header() != *other.header() && !uint_result.is_zero() {
            Self::new(Sign::Negative, uint_result.value)
        } else {
            Self::new(Sign::Positive, uint_result.value)
        }
    }
}
