use super::Number;

impl Number {
    /// `Math.ceil(self)`: round up, preserving `NaN`, infinities, and
    /// signed zero. A negative fraction above `-1` returns negative zero.
    pub fn ceil(self) -> Self {
        f64::from(self).ceil().into()
    }
}

#[cfg(test)]
mod tests {
    use super::Number;

    fn bits(value: f64) -> u64 {
        f64::from(Number::from(value).ceil()).to_bits()
    }

    #[test]
    fn rounds_up_without_integer_width_limits() {
        for (value, expected) in [
            (1.75, 2.0f64),
            (-1.75, -1.0),
            (f64::from_bits(0x3ff0_0000_0000_0001), 2.0),
            (-f64::from_bits(0x3ff0_0000_0000_0001), -1.0),
            (4_294_967_296.5, 4_294_967_297.0),
            (-4_294_967_296.5, -4_294_967_296.0),
            (4_503_599_627_370_495.5, 4_503_599_627_370_496.0),
            (-4_503_599_627_370_495.5, -4_503_599_627_370_495.0),
        ] {
            assert_eq!(bits(value), expected.to_bits());
        }
    }

    #[test]
    fn fractions_near_zero_round_up_and_preserve_negative_zero() {
        for value in [
            f64::from_bits(1),
            f64::MIN_POSITIVE,
            0.5,
            f64::from_bits(0x3fef_ffff_ffff_ffff),
        ] {
            assert_eq!(bits(value), 1.0f64.to_bits());
            assert_eq!(bits(-value), (-0.0f64).to_bits());
        }
    }

    #[test]
    fn special_values_and_integers_are_preserved() {
        for value in [
            0.0,
            -0.0,
            1.0,
            -1.0,
            4_503_599_627_370_496.0,
            -4_503_599_627_370_496.0,
            f64::MAX,
            -f64::MAX,
            f64::INFINITY,
            f64::NEG_INFINITY,
        ] {
            assert_eq!(bits(value), value.to_bits());
        }
        assert_eq!(bits(f64::NAN), f64::from(Number::NAN).to_bits());
    }
}
