use core::f64;

use crate::{nullish::Nullish, vm::{Any, Array, BigInt, Function, IVm, Object, String, dispatch::Dispatch, number_coercion::NumberCoercion, numeric::Numeric}};

/// Coerces the value to a numeric value (Number | BigInt), possibly producing an error result.
/// <https://tc39.es/ecma262/#sec-tonumeric>
///
/// Note: the function can return an error (JS throw).
pub struct NumericCoercion;

impl<A: IVm> Dispatch<A> for NumericCoercion {
    type Result = Result<Numeric<A>, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        Ok(Numeric::Number(NumberCoercion.nullish(v)?))
    }

    fn bool(self, v: bool) -> Self::Result {
        Ok(Numeric::Number(NumberCoercion.bool(v)?))
    }

    fn number(self, v: f64) -> Self::Result {
        Ok(Numeric::Number(v))
    }

    fn string(self, v: String<A>) -> Self::Result {
        Ok(Numeric::Number(NumberCoercion.string(v)?))
    }

    fn bigint(self, v: BigInt<A>) -> Self::Result {
        Ok(Numeric::BigInt(v))
    }

    fn object(self, v: Object<A>) -> Self::Result {
        Ok(Numeric::Number(NumberCoercion.object(v)?))
    }

    fn array(self, v: Array<A>) -> Self::Result {
        Ok(Numeric::Number(NumberCoercion.array(v)?))
    }

    fn function(self, v: Function<A>) -> Self::Result {
        Ok(Numeric::Number(NumberCoercion.function(v)?))
    }
}
