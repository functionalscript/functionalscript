use super::{
    big_uint::BigUint,
    interface::{Any, Complex},
    sign::Sign,
};

pub trait BigInt<U: Any<BigInt = Self>>: Complex<U> + BigUint<Sign> {
    fn normalize(&mut self) {
        self.normalize_unsigned();
        if self.is_zero() && *self.header() == Sign::Negative {
            self.set_header(Sign::Positive);
        }
    }

    fn negate(self) -> Self {
        match self.header() {
            Sign::Positive => Self::new(Sign::Negative, self.items_iter()),
            Sign::Negative => Self::new(Sign::Positive, self.items_iter()),
        }
    }

    fn multiply(self, other: Self) -> Self {
        if self.is_zero() || other.is_zero() {
            return Self::zero();
        }
        let negative = *self.header() != *other.header();
        let mut result = self.multiply_unsigned(other);
        if negative {
            result.set_header(Sign::Negative);
        }
        result.normalize();
        result
    }
}
