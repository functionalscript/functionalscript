use super::Number;

/// The one way in: every `NaN` becomes [`Number::NAN`], everything else
/// keeps its bits.
impl From<f64> for Number {
    fn from(v: f64) -> Self {
        if v.is_nan() { Self::NAN } else { Number(v) }
    }
}

impl From<Number> for f64 {
    fn from(v: Number) -> Self {
        v.0
    }
}

/// Exact: every `i32` is an `f64`. `ToInt32`'s results come back this way.
impl From<i32> for Number {
    fn from(v: i32) -> Self {
        Number(v as f64)
    }
}

/// Exact: every `u32` is an `f64`. `ToUint32`'s results come back this way.
impl From<u32> for Number {
    fn from(v: u32) -> Self {
        Number(v as f64)
    }
}
