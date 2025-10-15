use crate::{
    nullish::Nullish,
    vm::{
        any::Any, number_coercion::NumberCoercion, primitive::Primitive,
        string_coercion::StringCoercion, IVm,
    },
};

/// Preffered type for coercion to primitive, as per ECMAScript specification.
/// https://tc39.es/ecma262/#sec-toprimitive
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToPrimitivePreferredType {
    Number,
    String,
}

/// ECMAScript functions.
#[allow(dead_code)]
pub trait PrimitiveCoercion<A: IVm> {
    /// Coerces the value to a primitive type `Primitive<A>`, possibly producing an error result.
    /// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion
    /// https://tc39.es/ecma262/multipage/abstract-operations.html#sec-toprimitive
    fn coerce_to_primitive(
        &self,
        preferred_type: ToPrimitivePreferredType,
    ) -> Result<Primitive<A>, Any<A>>;
}

impl<A: IVm> PrimitiveCoercion<A> for bool {
    fn coerce_to_primitive(
        &self,
        preferred_type: ToPrimitivePreferredType,
    ) -> Result<Primitive<A>, Any<A>> {
        match preferred_type {
            ToPrimitivePreferredType::Number => Ok(Primitive::Number(self.coerce_to_number()?)),
            ToPrimitivePreferredType::String => Ok(Primitive::String(self.coerce_to_string()?)),
        }
    }
}

impl<A: IVm> PrimitiveCoercion<A> for Nullish {
    fn coerce_to_primitive(
        &self,
        preferred_type: ToPrimitivePreferredType,
    ) -> Result<Primitive<A>, Any<A>> {
        match preferred_type {
            ToPrimitivePreferredType::Number => Ok(Primitive::Number(self.coerce_to_number()?)),
            ToPrimitivePreferredType::String => Ok(Primitive::String(self.coerce_to_string()?)),
        }
    }
}
