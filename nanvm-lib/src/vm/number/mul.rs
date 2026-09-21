use core::ops::Mul;

use crate::vm::Number;

impl Mul for Number {
    type Output = Self;
    fn mul(self, rhs: Self) -> Self {
        (self.0 * rhs.0).into()
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::{Number, number::tests::bits};

    /// `-1 * 0` is `-0`: only a `NaN` is canonicalized, a signed zero keeps its sign.
    #[test]
    fn negative_zero_keeps_its_sign() {
        let z = Number::from(-1) * Number::from(0.0);
        assert_eq!(bits(z), (-0.0f64).to_bits());
    }
}
