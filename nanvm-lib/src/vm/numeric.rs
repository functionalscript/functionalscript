use std::ops::{Add, Div, Mul, Neg, Rem, Sub};

use crate::vm::{Any, BigInt, IVm, Unpacked};

const CANNOT_MIX_NUMBER_AND_BIGINT: &str =
    "TypeError: Cannot mix BigInt and other types, use explicit conversions";

/// <https://tc39.es/ecma262/#sec-tonumeric>
/// Represents ECMAScript numeric types, i.e. `Number` or `BigInt`, as defined by ToNumeric.
#[allow(dead_code)]
#[derive(Debug, PartialEq, Clone)]
pub enum Numeric<A: IVm> {
    Number(f64),
    BigInt(BigInt<A>),
}

impl<A: IVm> From<Numeric<A>> for Unpacked<A> {
    fn from(value: Numeric<A>) -> Self {
        match value {
            Numeric::Number(value) => Unpacked::Number(value),
            Numeric::BigInt(value) => Unpacked::BigInt(value),
        }
    }
}

impl<A: IVm> Neg for Numeric<A> {
    type Output = Self;

    fn neg(self) -> Self::Output {
        match self {
            Numeric::Number(value) => Numeric::Number(-value),
            Numeric::BigInt(value) => Numeric::BigInt(-value),
        }
    }
}

impl<A: IVm> Add for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn add(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Numeric::Number(a + b),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a + b),
            _ => return Err(CANNOT_MIX_NUMBER_AND_BIGINT.into()),
        })
    }
}

impl<A: IVm> Mul for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn mul(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Numeric::Number(a * b),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a * b),
            _ => return Err(CANNOT_MIX_NUMBER_AND_BIGINT.into()),
        })
    }
}

impl<A: IVm> Sub for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn sub(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Numeric::Number(a - b),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a - b),
            _ => return Err(CANNOT_MIX_NUMBER_AND_BIGINT.into()),
        })
    }
}

impl<A: IVm> Rem for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn rem(self, rhs: Self) -> Self::Output {
        match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Ok(Numeric::Number(a % b)),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Ok(Numeric::BigInt((a % b)?)),
            _ => Err(CANNOT_MIX_NUMBER_AND_BIGINT.into()),
        }
    }
}

impl<A: IVm> Div for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn div(self, rhs: Self) -> Self::Output {
        match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Ok(Numeric::Number(a / b)),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Ok(Numeric::BigInt((a / b)?)),
            _ => Err(CANNOT_MIX_NUMBER_AND_BIGINT.into()),
        }
    }
}

/// `Number::exponentiate`. Diverges from `f64::powf` (and C99's `pow`, which
/// `powf` follows) in exactly two spots: a `NaN` exponent is `NaN`
/// regardless of the base (C99 special-cases `pow(1, y) = 1` even for a
/// `NaN` `y`), and an infinite exponent against a base of magnitude 1 is
/// `NaN` (C99 gives `pow(±1, ±∞) = 1`). Every other case — zero/infinite
/// base or exponent, the sign and parity rules, a negative base with a
/// non-integer exponent giving `NaN` — already matches `powf` exactly, so
/// only these two get a special case.
fn number_exponentiate(base: f64, exponent: f64) -> f64 {
    if exponent.is_nan() || (exponent.is_infinite() && base.abs() == 1.0) {
        return f64::NAN;
    }
    base.powf(exponent)
}

impl<A: IVm> Numeric<A> {
    /// `**`. Not a `core::ops` trait — Rust has no operator for
    /// exponentiation, so this is a plain method, the same as `Any::pow`
    /// one level up.
    pub fn pow(self, rhs: Self) -> Result<Self, Any<A>> {
        match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => {
                Ok(Numeric::Number(number_exponentiate(a, b)))
            }
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Ok(Numeric::BigInt(a.pow(b)?)),
            _ => Err(CANNOT_MIX_NUMBER_AND_BIGINT.into()),
        }
    }
}
