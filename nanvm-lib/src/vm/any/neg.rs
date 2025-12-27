use core::ops::Neg;

use crate::vm::{numeric::Numeric, unpacked::Unpacked, Any, IVm};

impl<A: IVm> Neg for Any<A> {
    type Output = Result<Any<A>, Any<A>>;
    fn neg(self) -> Self::Output {
        // https://tc39.es/ecma262/#sec-unary-minus-operator
        match self.to_numeric() {
            Ok(Numeric::Number(n)) => Ok(Unpacked::Number(-n).into()),
            Ok(Numeric::BigInt(bi)) => Ok(Unpacked::BigInt(bi.negate()).into()),
            Err(e) => Err(e),
        }
    }
}

// TODO Consider UnaryMinus trait with unary_minus returning Result<Numeric<A>, Any<A>> where
// Numeric<A> is f64 | BigInt<A> enum, to represent ECMAScript unary minus operator for Rust code
// with better type precision. This would be similar to coerce_to_number but returning Numeric<A>
// instead of Any<A> of unary_plus in result type.
