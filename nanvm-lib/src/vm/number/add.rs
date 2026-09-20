use core::ops::Add;

use crate::vm::Number;

impl Add for Number {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        (self.0 + rhs.0).into()
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::{
        Number,
        number::{CANONICAL_NAN, tests::bits},
    };

    /// `NaN + 0` is the canonical `NaN`, whatever bits the hardware gave it.
    #[test]
    fn nan_is_canonical() {
        let nan = Number::from(f64::NAN);
        assert_eq!(bits(nan + Number::from(0.0)), CANONICAL_NAN);
    }
}
