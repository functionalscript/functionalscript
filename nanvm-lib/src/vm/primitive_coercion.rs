use crate::{
    nullish::Nullish,
    vm::{dispatch::Dispatch, primitive::Primitive, Any, IVm},
};

/// Preferred type for coercion to primitive, as per ECMAScript specification.
/// <https://tc39.es/ecma262/#sec-toprimitive>
/// Note that preferredType can be absent - we express that by using None value of
/// Option<ToPrimitivePreferredType>.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToPrimitivePreferredType {
    Number,
    String,
}

/// Coerces the value to a primitive type `Primitive<A>`, possibly producing an error result.
/// <https://tc39.es/ecma262/#sec-toprimitive>
#[allow(dead_code)]
pub struct PrimitiveCoercionOp(pub Option<ToPrimitivePreferredType>);

impl<A: IVm> Dispatch<A> for PrimitiveCoercionOp {
    type Result = Result<Primitive<A>, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        Ok(Primitive::Nullish(v))
    }

    fn bool(self, v: bool) -> Self::Result {
        Ok(Primitive::Boolean(v))
    }

    fn number(self, v: f64) -> Self::Result {
        Ok(Primitive::Number(v))
    }

    fn string(self, v: super::String<A>) -> Self::Result {
        Ok(Primitive::String(v))
    }

    fn bigint(self, v: super::BigInt<A>) -> Self::Result {
        Ok(Primitive::BigInt(v))
    }

    fn object(self, _: super::Object<A>) -> Self::Result {
        // Objects cannot be directly converted to primitives without coercion.
        // This would typically require calling valueOf() or toString() methods.
        todo!("Object to primitive coercion not implemented")
    }

    fn array(self, _: super::Array<A>) -> Self::Result {
        // Arrays cannot be directly converted to primitives without coercion.
        // This would typically require calling valueOf() or toString() methods.
        todo!("Array to primitive coercion not implemented")
    }

    fn function(self, _: super::Function<A>) -> Self::Result {
        // Functions cannot be directly converted to primitives without coercion.
        // This would typically require calling valueOf() or toString() methods.
        todo!("Function to primitive coercion not implemented")
    }
}
