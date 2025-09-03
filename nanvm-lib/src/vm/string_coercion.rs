use crate::{
    nullish::Nullish,
    vm::{any::Any, IVm, String16},
};

/// ECMAScript functions.
pub trait StringCoercion<A: IVm> {
    /// Coerces the value to a `String16<A>`, possibly producing an error result.
    /// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion
    /// https://tc39.es/ecma262/multipage/abstract-operations.html#sec-tostring
    fn coerce_to_string(&self) -> Result<String16<A>, Any<A>>;
}

impl<A: IVm> StringCoercion<A> for bool {
    fn coerce_to_string(&self) -> Result<String16<A>, Any<A>> {
        Ok((match self {
            true => "true",
            false => "false",
        })
        .into())
    }
}

impl<A: IVm> StringCoercion<A> for Nullish {
    fn coerce_to_string(&self) -> Result<String16<A>, Any<A>> {
        Ok((match self {
            Nullish::Null => "null",
            Nullish::Undefined => "undefined",
        })
        .into())
    }
}
