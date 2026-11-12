use super::Number;

/// The one way in: every `NaN` becomes [`Number::NAN`], everything else
/// keeps its bits.
impl From<f64> for Number {
    fn from(v: f64) -> Self {
        // An optimized float NaN select around sqrt may keep Intel's negative
        // NaN. An integer predicate preserves the canonical bits on return.
        if v.to_bits() & 0x7fff_ffff_ffff_ffff > 0x7ff0_0000_0000_0000 {
            Self::NAN
        } else {
            Number(v)
        }
    }
}

impl From<Number> for f64 {
    fn from(v: Number) -> Self {
        v.0
    }
}

/// `Number(true)` is `1` and `Number(false)` is `0`: `ToNumber` of a
/// boolean.
impl From<bool> for Number {
    fn from(v: bool) -> Self {
        Number(v as u8 as f64)
    }
}

/// Exact: every `i32` is a `Number`. `ToInt32`'s results come back this way.
impl From<i32> for Number {
    fn from(v: i32) -> Self {
        Number(v as f64)
    }
}

/// Exact: every `u32` is a `Number`. `ToUint32`'s results come back this way.
impl From<u32> for Number {
    fn from(v: u32) -> Self {
        Number(v as f64)
    }
}
