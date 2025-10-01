use crate::{
    nullish::Nullish,
    vm::{any::Any, number_coercion::NumberCoercion, string_coercion::StringCoercion, IVm},
};

/// Preffered type for coercion to primitive, as per ECMAScript specification.
/// https://tc39.es/ecma262/#sec-toprimitive
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToPrimitivePreferredType {
    Number,
    String,
}

/// ECMAScript functions.
pub trait PrimitiveCoercion<A: IVm> {
    /// Coerces the value to a primitive type
    /// `String16<A>`, possibly producing an error result.
    /// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion
    /// https://tc39.es/ecma262/multipage/abstract-operations.html#sec-tostring
    fn coerce_to_primitive(
        &self,
        preferred_type: ToPrimitivePreferredType,
    ) -> Result<Any<A>, Any<A>>;
}

use crate::vm::unpacked::Unpacked;

impl<A: IVm> PrimitiveCoercion<A> for bool {
    fn coerce_to_primitive(
        &self,
        preferred_type: ToPrimitivePreferredType,
    ) -> Result<Any<A>, Any<A>> {
        match preferred_type {
            ToPrimitivePreferredType::Number => {
                Ok(Unpacked::Number(self.coerce_to_number()?).into())
            }
            ToPrimitivePreferredType::String => {
                Ok(Unpacked::String(self.coerce_to_string()?).into())
            }
        }
    }
}

impl<A: IVm> PrimitiveCoercion<A> for Nullish {
    fn coerce_to_primitive(
        &self,
        preferred_type: ToPrimitivePreferredType,
    ) -> Result<Any<A>, Any<A>> {
        match preferred_type {
            ToPrimitivePreferredType::Number => {
                Ok(Unpacked::Number(self.coerce_to_number()?).into())
            }
            ToPrimitivePreferredType::String => {
                Ok(Unpacked::String(self.coerce_to_string()?).into())
            }
        }
    }
}
