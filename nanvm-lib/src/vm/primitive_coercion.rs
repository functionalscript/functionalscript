use crate::{
    nullish::Nullish,
    vm::{dispatch::Dispatch, primitive::Primitive, IVm},
};

/// Preferred type for coercion to primitive, as per ECMAScript specification.
/// <https://tc39.es/ecma262/#sec-toprimitive>
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToPrimitivePreferredType {
    Number,
    String,
}

/// Coerces the value to a primitive type `Primitive<A>`, possibly producing an error result.
/// <https://tc39.es/ecma262/#sec-toprimitive>
pub struct PrimitiveCoercionOp;

impl<A: IVm> Dispatch<A> for PrimitiveCoercionOp {
    type Result = Primitive<A>;

    fn nullish(self, v: Nullish) -> Self::Result {
        Primitive::Nullish(v)
    }

    fn bool(self, v: bool) -> Self::Result {
        Primitive::Boolean(v)
    }

    fn number(self, _: f64) -> Self::Result {
        todo!()
    }

    fn string(self, _: super::String16<A>) -> Self::Result {
        todo!()
    }

    fn bigint(self, _: super::BigInt<A>) -> Self::Result {
        todo!()
    }

    fn object(self, _: super::Object<A>) -> Self::Result {
        todo!()
    }

    fn array(self, _: super::Array<A>) -> Self::Result {
        todo!()
    }

    fn function(self, _: super::Function<A>) -> Self::Result {
        todo!()
    }
}
