use std::ops::{Mul, Neg, Sub};

use crate::vm::{Any, BigInt, IVm, Unpacked};

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

impl<A: IVm> Mul for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn mul(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Numeric::Number(a * b),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a * b),
            _ => return Err("TODO: Cannot multiply Number and BigInt".into()),
        })
    }
}

impl<A: IVm> Sub for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn sub(self, rhs: Self) -> Self::Output {
        Ok(match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Numeric::Number(a - b),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Numeric::BigInt(a - b),
            _ => return Err("TODO: Cannot subtract Number and BigInt".into()),
        })
    }
}
