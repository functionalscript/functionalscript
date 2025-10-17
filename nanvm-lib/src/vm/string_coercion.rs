use crate::{
    nullish::Nullish,
    vm::{any::Any, IVm, String16},
};

/// ECMAScript functions.
pub trait StringCoercion<A: IVm> {
    /// Coerces the value to a `String16<A>`, possibly producing an error result.
    /// <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#string_coercion>
    /// <https://tc39.es/ecma262/#sec-tostring>
    ///
    /// Notes:
    /// 1. It can throw an error. For example: `{ toString: () => { throw 0 } } + ''`
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>>;
}

impl<A: IVm> StringCoercion<A> for bool {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        match self {
            true => "true",
            false => "false",
        }
        .to_string16_result()
    }
}

impl<A: IVm> StringCoercion<A> for Nullish {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        match self {
            Nullish::Null => "null",
            Nullish::Undefined => "undefined",
        }
        .to_string16_result()
    }
}

pub trait ToString16Result<A: IVm> {
    fn to_string16_result(self) -> Result<String16<A>, Any<A>>;
}

impl<A: IVm> ToString16Result<A> for &str {
    fn to_string16_result(self) -> Result<String16<A>, Any<A>> {
        Ok(self.into())
    }
}
