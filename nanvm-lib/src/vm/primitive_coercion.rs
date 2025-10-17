use crate::{
    nullish::Nullish,
    vm::{
        any::Any, number_coercion::NumberCoercion, primitive::Primitive,
        string_coercion::StringCoercion, IVm,
    },
};

/// Preferred type for coercion to primitive, as per ECMAScript specification.
/// <https://tc39.es/ecma262/#sec-toprimitive>
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToPrimitivePreferredType {
    Number,
    String,
}

/// ECMAScript functions.
#[allow(dead_code)]
pub trait PrimitiveCoercion<A: IVm>: NumberCoercion<A> + StringCoercion<A> + Sized {
    /// Coerces the value to a primitive type `Primitive<A>`, possibly producing an error result.
    /// <https://tc39.es/ecma262/#sec-toprimitive>
    fn coerce_to_primitive(
        self,
        preferred_type: Option<ToPrimitivePreferredType>,
    ) -> Result<Primitive<A>, Any<A>> {
        match preferred_type {
            Some(ToPrimitivePreferredType::Number) => {
                Ok(Primitive::Number(self.coerce_to_number()?))
            }
            Some(ToPrimitivePreferredType::String) => {
                Ok(Primitive::String(self.coerce_to_string()?))
            }
            None => Ok(self.coerce_to_primitive_default()),
        }
    }

    fn coerce_to_primitive_default(self) -> Primitive<A>;
}

impl<A: IVm> PrimitiveCoercion<A> for bool {
    fn coerce_to_primitive_default(self) -> Primitive<A> {
        Primitive::Boolean(self)
    }
}

impl<A: IVm> PrimitiveCoercion<A> for Nullish {
    fn coerce_to_primitive_default(self) -> Primitive<A> {
        Primitive::Nullish(self)
    }
}
