use crate::vm::Number;

/// The `modulo 2^32` step `ToInt32` shares with `ToUint32`
/// (<https://tc39.es/ecma262/#sec-toint32> / <https://tc39.es/ecma262/#sec-touint32>):
/// non-finite (`NaN`, `±Infinity`) becomes `+0`, otherwise the number is
/// truncated toward zero and reduced to its non-negative remainder modulo
/// `2^32`. Unlike integer `%`, `f64`'s `%` (IEEE 754 remainder, C's `fmod`)
/// never rounds: for any two finite operands the true mathematical
/// remainder is itself exactly representable in the same format, so this
/// step introduces no error of its own even when `number.trunc()` is a huge
/// magnitude — whatever rounding happened is already baked into `number`
/// from when it became a `Number` via `ToNumber`, upstream of this function.
fn modulo_2_32(number: f64) -> u32 {
    if !number.is_finite() {
        return 0;
    }
    const TWO_POW_32: f64 = 4294967296.0;
    let remainder = number.trunc() % TWO_POW_32;
    let non_negative = if remainder < 0.0 {
        remainder + TWO_POW_32
    } else {
        remainder
    };
    non_negative as u32
}

impl Number {
    /// `ToInt32`. <https://tc39.es/ecma262/#sec-toint32>
    pub fn to_int32(self) -> i32 {
        modulo_2_32(self.0) as i32
    }

    /// `ToUint32`. <https://tc39.es/ecma262/#sec-touint32> — used by `<<`/`>>`
    /// (for the shift-count operand) and `>>>` (for both operands, since it
    /// has no signed form).
    pub fn to_uint32(self) -> u32 {
        modulo_2_32(self.0)
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::Number;

    fn to_int32(v: f64) -> i32 {
        Number::from(v).to_int32()
    }

    fn to_uint32(v: f64) -> u32 {
        Number::from(v).to_uint32()
    }

    #[test]
    fn non_finite_and_zero() {
        for n in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY, 0.0, -0.0] {
            assert_eq!(to_int32(n), 0);
            assert_eq!(to_uint32(n), 0);
        }
    }

    #[test]
    fn truncates_toward_zero() {
        assert_eq!(to_int32(3.9), 3);
        assert_eq!(to_int32(-3.9), -3);
    }

    #[test]
    fn in_range_round_trips() {
        assert_eq!(to_int32(42.0), 42);
        assert_eq!(to_int32(-42.0), -42);
        assert_eq!(to_uint32(42.0), 42);
    }

    #[test]
    fn wraps_at_32_bit_boundary() {
        // 2^31 is the first value ToInt32 reinterprets as negative; ToUint32
        // keeps it as-is, since it never reinterprets the sign bit.
        assert_eq!(to_int32(2147483648.0), i32::MIN);
        assert_eq!(to_uint32(2147483648.0), 2147483648);
        // 2^32 - 1 wraps to -1 as a signed 32-bit value.
        assert_eq!(to_int32(4294967295.0), -1);
        assert_eq!(to_uint32(4294967295.0), 4294967295);
        // 2^32 itself reduces to 0.
        assert_eq!(to_int32(4294967296.0), 0);
        assert_eq!(to_uint32(4294967296.0), 0);
    }
}
