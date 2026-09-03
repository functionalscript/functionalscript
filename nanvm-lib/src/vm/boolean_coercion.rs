use crate::{
    common::sized_index::SizedIndex,
    vm::{Array, BigInt, Function, IVm, Object, String, dispatch::Dispatch, nullish::Nullish},
};

/// Coerces the value to a `bool`. Unlike `NumberCoercion`/`StringCoercion`,
/// this never fails — `ToBoolean` inspects the operand's type directly and
/// never calls `ToPrimitive`, so there is nothing here that can throw.
/// <https://tc39.es/ecma262/#sec-toboolean>
///
/// It equals to `!!x` in JavaScript.
pub struct BooleanCoercion;

impl<A: IVm> Dispatch<A> for BooleanCoercion {
    type Result = bool;

    fn nullish(self, _: Nullish) -> Self::Result {
        false
    }

    fn bool(self, v: bool) -> Self::Result {
        v
    }

    fn number(self, v: f64) -> Self::Result {
        v != 0.0 && !v.is_nan()
    }

    fn string(self, v: String<A>) -> Self::Result {
        !v.is_empty()
    }

    fn bigint(self, v: BigInt<A>) -> Self::Result {
        v != BigInt::default()
    }

    fn object(self, _: Object<A>) -> Self::Result {
        true
    }

    fn array(self, _: Array<A>) -> Self::Result {
        true
    }

    fn function(self, _: Function<A>) -> Self::Result {
        true
    }
}
