use crate::{
    nullish::Nullish,
    vm::{any::Any, IVm},
};

/// ECMAScript functions.
pub trait NumberCoercion<A: IVm> {
    /// Coerces the value to a primitive type
    /// `String16<A>`, possibly producing an error result.
    /// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion
    /// https://tc39.es/ecma262/multipage/abstract-operations.html#sec-tostring
    fn coerce_to_number(&self) -> Result<f64, Any<A>>;
}

impl<A: IVm> NumberCoercion<A> for bool {
    fn coerce_to_number(&self) -> Result<f64, Any<A>> {
        Ok(if *self { 1.0 } else { 0.0 })
    }
}

impl<A: IVm> NumberCoercion<A> for Nullish {
    fn coerce_to_number(&self) -> Result<f64, Any<A>> {
        Ok(match self {
            Nullish::Null => 0.0,
            Nullish::Undefined => 1.0,
        })
    }
}

