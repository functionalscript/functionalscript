use super::Number;

impl Number {
    /// `Math.clz32(self)`: the number of leading zero bits of the value
    /// `ToUint32` makes of it, from `0` to `32`. A value the conversion
    /// reads as zero — both zeros, `NaN`, both infinities, a fraction below
    /// one — has thirty-two, which is what `u32::leading_zeros` answers for
    /// zero.
    pub fn clz32(self) -> Self {
        self.to_uint32().leading_zeros().into()
    }
}

#[cfg(test)]
mod tests {
    use super::Number;

    fn clz32(value: f64) -> Number {
        Number::from(value).clz32()
    }

    #[test]
    fn counts_the_leading_zeros_of_the_uint32() {
        for (value, expected) in [
            (1.0, 31u32),
            (2.0, 30),
            (3.0, 30),
            (255.0, 24),
            (256.0, 23),
            (65_535.0, 16),
            (65_536.0, 15),
            (2_147_483_647.0, 1),
            (2_147_483_648.0, 0),
            (4_294_967_295.0, 0),
        ] {
            assert_eq!(clz32(value), Number::from(expected));
        }
    }

    #[test]
    fn converts_with_to_uint32_first() {
        for (value, expected) in [
            // negative integers wrap modulo 2^32
            (-1.0, 0u32),
            (-2_147_483_648.0, 0),
            (-4_294_967_295.0, 31),
            // integers at and above 2^32 are reduced
            (4_294_967_296.0, 32),
            (4_294_967_297.0, 31),
            // a fraction is truncated toward zero
            (1.9, 31),
            (-1.9, 0),
            (0.5, 32),
            (-0.5, 32),
        ] {
            assert_eq!(clz32(value), Number::from(expected));
        }
    }

    #[test]
    fn zero_and_the_values_that_convert_to_it_have_thirty_two() {
        for value in [0.0, -0.0, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            assert_eq!(clz32(value), Number::from(32u32));
        }
    }
}
