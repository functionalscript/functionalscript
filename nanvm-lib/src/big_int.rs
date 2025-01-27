use super::{
    big_uint::BigUint,
    interface::{Any, Complex},
    sign::Sign,
};

pub trait BigInt<U: Any<BigInt = Self>>: Complex<U> + BigUint<Sign> {
    fn normalize(&mut self) {
        BigUint::<Sign>::normalize(self);
        if self.is_zero() && *self.header() == Sign::Negative {
            self.set_header(Sign::Positive);
        }
    }

    fn negate(self) -> Self {
        match self.header() {
            Sign::Positive => Self::new(Sign::Negative, &self.items()),
            Sign::Negative => Self::new(Sign::Positive, &self.items()),
        }
    }

    fn multiply(self, other: Self) -> Self {
        if self.is_zero() || other.is_zero() {
            return Self::zero();
        }
        let negative = *self.header() != *other.header();
        let mut result: Self = BigUint::<Sign>::multiply(&self, other);
        if negative {
            result.set_header(Sign::Negative);
        }
        BigInt::normalize(&mut result);
        result
    }
}
