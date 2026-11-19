use super::Number;

impl Number {
    /// `Math.abs(self)`: preserve the magnitude and clear the sign, including
    /// `-0` and negative infinity. `NaN` remains the canonical `NaN`.
    pub fn abs(self) -> Self {
        f64::from(self).abs().into()
    }
}

#[cfg(test)]
mod tests {
    use super::Number;

    fn bits(value: f64) -> u64 {
        f64::from(Number::from(value).abs()).to_bits()
    }

    #[test]
    fn fractional_and_large_magnitudes_are_preserved() {
        for magnitude in [
            1.75,
            f64::from_bits(0x3fff_ffff_ffff_ffff),
            4_294_967_296.5,
            4_503_599_627_370_495.5,
            4_503_599_627_370_496.0,
            f64::MAX,
        ] {
            assert_eq!(bits(magnitude), magnitude.to_bits());
            assert_eq!(bits(-magnitude), magnitude.to_bits());
        }
    }

    #[test]
    fn zero_and_tiny_magnitudes_have_positive_sign() {
        for magnitude in [
            0.0,
            f64::from_bits(1),
            f64::from_bits(0x000f_ffff_ffff_ffff),
            f64::MIN_POSITIVE,
            0.5,
        ] {
            assert_eq!(bits(magnitude), magnitude.to_bits());
            assert_eq!(bits(-magnitude), magnitude.to_bits());
        }
    }

    #[test]
    fn infinities_and_nan_have_canonical_results() {
        assert_eq!(bits(f64::INFINITY), f64::INFINITY.to_bits());
        assert_eq!(bits(f64::NEG_INFINITY), f64::INFINITY.to_bits());
        for value in [
            f64::NAN,
            -f64::NAN,
            f64::from_bits(0x7ff8_0000_0000_0001),
            f64::from_bits(0xfff8_0000_0000_0001),
            f64::from_bits(0x7ff0_0000_0000_0001),
        ] {
            assert_eq!(bits(value), f64::from(Number::NAN).to_bits());
        }
    }
}
