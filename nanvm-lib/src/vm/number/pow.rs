use crate::vm::Number;

impl Number {
    /// `Math.pow(self, exponent)`, which is `self ** exponent`: the spec's
    /// `Number::exponentiate`. Diverges from `f64::powf` (and C99's `pow`,
    /// which `powf` follows) in exactly two spots: a `NaN` exponent is `NaN`
    /// regardless of the base (C99 special-cases `pow(1, y) = 1` even for a
    /// `NaN` `y`), and an infinite exponent against a base of magnitude 1 is
    /// `NaN` (C99 gives `pow(±1, ±∞) = 1`). Every other case — zero/infinite
    /// base or exponent, the sign and parity rules, a negative base with a
    /// non-integer exponent giving `NaN` — already matches `powf` exactly, so
    /// only these two get a special case. Not a `core::ops` trait — Rust has
    /// no operator for exponentiation — so a plain method, the same as
    /// `BigInt::pow` and `Any::pow`.
    pub fn pow(self, exponent: Self) -> Self {
        if exponent.is_nan() || (!exponent.is_finite() && self.0.abs() == 1.0) {
            return Self::NAN;
        }
        self.0.powf(exponent.0).into()
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::Number;

    fn n(v: f64) -> Number {
        v.into()
    }

    /// The two departures from `powf`, and one case that follows it.
    #[test]
    fn departures_from_powf() {
        assert!(n(1.0).pow(Number::NAN).is_nan());
        assert!(n(1.0).pow(n(f64::INFINITY)).is_nan());
        assert!(n(-1.0).pow(n(f64::NEG_INFINITY)).is_nan());
        assert_eq!(n(2.0).pow(n(10.0)), n(1024.0));
    }
}
