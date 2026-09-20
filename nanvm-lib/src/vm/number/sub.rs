use core::ops::Sub;

use crate::vm::Number;

impl Sub for Number {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self {
        (self.0 - rhs.0).into()
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::{
        Number,
        number::{CANONICAL_NAN, tests::bits},
    };

    /// `Infinity - Infinity` is a `NaN` the hardware made, and it comes out canonical.
    #[test]
    fn nan_is_canonical() {
        let inf = Number::from(f64::INFINITY);
        assert_eq!(bits(inf - inf), CANONICAL_NAN);
    }
}
