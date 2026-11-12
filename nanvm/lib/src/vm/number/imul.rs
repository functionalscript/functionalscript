use super::Number;

impl Number {
    /// `Math.imul(self, rhs)`: multiply the low 32 bits and interpret the
    /// wrapping result as a signed integer. `ToInt32` and `ToUint32` have
    /// the same bits, so signed native wrapping multiplication is exact.
    pub fn imul(self, rhs: Self) -> Self {
        self.to_int32().wrapping_mul(rhs.to_int32()).into()
    }
}

#[cfg(test)]
mod tests {
    use super::Number;

    fn imul(left: f64, right: f64) -> Number {
        Number::from(left).imul(right.into())
    }

    #[test]
    fn product_wraps_and_returns_a_signed_integer() {
        for (left, right, expected) in [
            (2.0, 4.0, 8),
            (-1.0, 8.0, -8),
            (4_294_967_295.0, 5.0, -5),
            (2_147_483_647.0, 2.0, -2),
            (2_147_483_648.0, -1.0, i32::MIN),
            (2_147_483_648.0, 2.0, 0),
            (4_294_967_295.0, 4_294_967_295.0, 1),
            (65_536.0, 65_536.0, 0),
        ] {
            assert_eq!(imul(left, right), Number::from(expected));
            assert_eq!(imul(right, left), Number::from(expected));
        }
    }

    #[test]
    fn operands_truncate_and_reduce_modulo_two_to_the_32() {
        for (left, right, expected) in [
            (3.9, -2.9, -6),
            (4_294_967_297.0, 3.0, 3),
            (-4_294_967_297.0, 3.0, -3),
            (9_007_199_254_740_991.0, 3.0, -3),
            (9_007_199_254_740_992.0, 3.0, 0),
            (f64::MAX, 3.0, 0),
        ] {
            assert_eq!(imul(left, right), Number::from(expected));
        }
    }

    #[test]
    fn zero_and_non_finite_operands_produce_positive_zero() {
        for value in [
            0.0,
            -0.0,
            f64::from_bits(1),
            -0.5,
            f64::NAN,
            f64::INFINITY,
            f64::NEG_INFINITY,
        ] {
            assert_eq!(f64::from(imul(value, -5.0)).to_bits(), 0.0f64.to_bits());
            assert_eq!(f64::from(imul(-5.0, value)).to_bits(), 0.0f64.to_bits());
        }
    }
}
