use super::Number;

impl Number {
    /// `Math.sqrt(self)`: the native square root, preserving signed zero
    /// and returning the canonical `NaN` for negative nonzero inputs.
    pub fn sqrt(self) -> Self {
        f64::from(self).sqrt().into()
    }
}

#[cfg(test)]
mod tests {
    use super::Number;

    fn bits(value: f64) -> u64 {
        f64::from(Number::from(value).sqrt()).to_bits()
    }

    #[test]
    fn finite_roots_round_to_binary64() {
        for (value, expected) in [
            (1.0, 1.0f64),
            (4.0, 2.0),
            (9.0, 3.0),
            (0.25, 0.5),
            (4_294_967_296.0, 65_536.0),
        ] {
            assert_eq!(bits(value), expected.to_bits());
        }
        assert_eq!(bits(2.0), 0x3ff6_a09e_667f_3bcd);
        assert_eq!(bits(f64::MAX), 0x5fef_ffff_ffff_ffff);
    }

    #[test]
    fn zeros_and_tiny_positive_roots_keep_their_bits() {
        assert_eq!(bits(0.0), 0.0f64.to_bits());
        assert_eq!(bits(-0.0), (-0.0f64).to_bits());
        assert_eq!(bits(f64::from_bits(1)), 0x1e60_0000_0000_0000);
        assert_eq!(bits(f64::MIN_POSITIVE), 0x2000_0000_0000_0000);
    }

    #[test]
    fn domain_errors_and_special_values_have_canonical_results() {
        assert_eq!(bits(f64::INFINITY), f64::INFINITY.to_bits());
        for value in [
            -1.0,
            -f64::from_bits(1),
            -f64::MAX,
            f64::NEG_INFINITY,
            f64::NAN,
            -f64::NAN,
        ] {
            assert_eq!(bits(value), f64::from(Number::NAN).to_bits());
        }
    }
}
