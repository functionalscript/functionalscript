use core::ops::Neg;

use crate::vm::{Any, IVm};

impl<A: IVm> Neg for Any<A> {
    type Output = Result<Any<A>, Any<A>>;
    fn neg(self) -> Self::Output {
        todo!()
    }
}

// TODO Consider UnaryMinus trait with unary_minus returning Result<Numeric<A>, Any<A>> where
// Numeric<A> is f64 | BigInt<A> enum, to represent ECMAScript unary minus operator for Rust code
// with better type precision. This would be similar to coerce_to_number but returning Numeric<A>
// instead of Any<A> of unary_plus in result type.
