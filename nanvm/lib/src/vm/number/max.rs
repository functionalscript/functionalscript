use super::Number;

impl Number {
    /// `Math.max(self, rhs)`: return `NaN` if either operand is `NaN`,
    /// prefer positive zero over negative zero, and otherwise use the native
    /// maximum. Rust's native maximum alone ignores a single `NaN` and does
    /// not promise which signed zero wins a tie.
    pub fn max(self, rhs: Self) -> Self {
        if self.is_nan() || rhs.is_nan() {
            return Self::NAN;
        }
        let left = f64::from(self);
        let right = f64::from(rhs);
        if left == 0.0 && right == 0.0 {
            return if left.is_sign_positive() { self } else { rhs };
        }
        left.max(right).into()
    }
}

#[cfg(test)]
mod tests {
    use super::Number;

    fn bits(left: f64, right: f64) -> u64 {
        f64::from(Number::from(left).max(right.into())).to_bits()
    }

    #[inline(never)]
    fn returned_max(left: Number, right: Number) -> Number {
        left.max(right)
    }

    #[test]
    fn either_nan_returns_canonical_nan_across_a_call_boundary() {
        for nan in [
            f64::NAN,
            -f64::NAN,
            f64::from_bits(0x7ff8_0000_0000_0001),
            f64::from_bits(0xfff8_0000_0000_0001),
            f64::from_bits(0x7ff0_0000_0000_0001),
        ] {
            let nan = Number::from(std::hint::black_box(nan));
            for other in [0.0, -1.0, f64::INFINITY, f64::NEG_INFINITY, f64::NAN] {
                let other = Number::from(std::hint::black_box(other));
                assert_eq!(
                    f64::from(returned_max(nan, other)).to_bits(),
                    f64::from(Number::NAN).to_bits()
                );
                assert_eq!(
                    f64::from(returned_max(other, nan)).to_bits(),
                    f64::from(Number::NAN).to_bits()
                );
            }
        }
    }

    #[test]
    fn zero_ties_prefer_positive_zero_in_either_order() {
        assert_eq!(bits(0.0, 0.0), 0.0f64.to_bits());
        assert_eq!(bits(-0.0, 0.0), 0.0f64.to_bits());
        assert_eq!(bits(0.0, -0.0), 0.0f64.to_bits());
        assert_eq!(bits(-0.0, -0.0), (-0.0f64).to_bits());
        assert_eq!(bits(-0.0, -f64::from_bits(1)), (-0.0f64).to_bits());
        assert_eq!(bits(-f64::from_bits(1), -0.0), (-0.0f64).to_bits());
    }

    #[test]
    fn native_maximum_compares_finite_values_and_infinities() {
        for (left, right, expected) in [
            (1.0, 2.0, 2.0f64),
            (-2.0, -1.0, -1.0),
            (1.5, 1.5, 1.5),
            (f64::from_bits(1), 0.0, f64::from_bits(1)),
            (-f64::MAX, f64::MAX, f64::MAX),
            (f64::MAX, f64::INFINITY, f64::INFINITY),
            (f64::NEG_INFINITY, -f64::MAX, -f64::MAX),
            (f64::NEG_INFINITY, f64::INFINITY, f64::INFINITY),
            (f64::NEG_INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY),
        ] {
            assert_eq!(bits(left, right), expected.to_bits());
            assert_eq!(bits(right, left), expected.to_bits());
        }
    }
}
