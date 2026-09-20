use core::ops::Neg;

use crate::vm::Number;

impl Neg for Number {
    type Output = Self;
    fn neg(self) -> Self {
        (-self.0).into()
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::{
        Number,
        number::{CANONICAL_NAN, tests::bits},
    };

    /// `-NaN`, the program the sign flip comes from: `f64`'s negation
    /// flips the sign bit, and the result is the canonical `NaN` anyway.
    #[test]
    fn nan_is_canonical() {
        assert_eq!(bits(-Number::from(f64::NAN)), CANONICAL_NAN);
        assert_eq!(bits(-Number::from(0.0)), (-0.0f64).to_bits());
    }
}
