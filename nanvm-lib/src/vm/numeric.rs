use crate::vm::{Any, BigInt, IVm, ToAny};

/// <https://tc39.es/ecma262/#sec-tonumeric>
/// Represents ECMAScript numeric types, i.e. `Number` or `BigInt`, as defined by ToNumeric.
#[allow(dead_code)]
#[derive(Debug, PartialEq, Clone)]
pub enum Numeric<A: IVm> {
    Number(f64),
    BigInt(BigInt<A>),
}

impl<A: IVm> std::ops::Mul for Numeric<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn mul(self, rhs: Self) -> Self::Output {
        match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Ok((a * b).to_any()),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Ok((a * b).to_any()),
            _ => Err("TODO: Cannot multiply Number and BigInt".into()),
        }
    }
}
