use crate::vm::Number;

impl Number {
    /// `ToIntegerOrInfinity` (<https://tc39.es/ecma262/#sec-tointegerorinfinity>)
    /// of a number: `NaN` and either zero are `0`, an infinity is itself,
    /// and everything else is truncated toward zero. The specification's
    /// answer is a mathematical value, so a `-0` never comes out of it:
    /// `-0.5` truncates to `0`, not `-0`, and the addition below is what
    /// folds the sign — `-0.0 + 0.0` is `0.0` in IEEE 754.
    pub fn to_integer_or_infinity(self) -> Number {
        let n = f64::from(self);
        if n.is_nan() {
            return Number::from(0.0);
        }
        Number::from(n.trunc() + 0.0)
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::Number;

    fn bits(v: f64) -> u64 {
        f64::from(Number::from(v).to_integer_or_infinity()).to_bits()
    }

    #[test]
    fn nan_and_zeros_are_zero() {
        for v in [f64::NAN, 0.0, -0.0] {
            assert_eq!(bits(v), 0.0f64.to_bits());
        }
    }

    #[test]
    fn infinities_are_themselves() {
        assert_eq!(bits(f64::INFINITY), f64::INFINITY.to_bits());
        assert_eq!(bits(f64::NEG_INFINITY), f64::NEG_INFINITY.to_bits());
    }

    /// Truncation toward zero, and no `-0` for a negative fraction.
    #[test]
    fn truncates_toward_zero() {
        assert_eq!(bits(1.7), 1.0f64.to_bits());
        assert_eq!(bits(-1.7), (-1.0f64).to_bits());
        assert_eq!(bits(-0.5), 0.0f64.to_bits());
        assert_eq!(bits(4294967296.5), 4294967296.0f64.to_bits());
    }
}
