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

    fn number(self, v: f64) -> Self::Result {
        Primitive::Number(v)
    }

    fn string(self, v: super::String<A>) -> Self::Result {
        Primitive::String(v)
    }

    fn bigint(self, v: super::BigInt<A>) -> Self::Result {
        Primitive::BigInt(v)
    }

    fn object(self, v: super::Object<A>) -> Self::Result {
        // Objects cannot be directly converted to primitives without coercion.
        // This would typically require calling valueOf() or toString() methods.
        todo!("Object to primitive coercion not implemented")
    }

    fn array(self, v: super::Array<A>) -> Self::Result {
        // Arrays cannot be directly converted to primitives without coercion.
        // This would typically require calling valueOf() or toString() methods.
        todo!("Array to primitive coercion not implemented")
    }

    fn function(self, v: super::Function<A>) -> Self::Result {
        // Functions cannot be directly converted to primitives without coercion.
        // This would typically require calling valueOf() or toString() methods.
        todo!("Function to primitive coercion not implemented")
    }
}
