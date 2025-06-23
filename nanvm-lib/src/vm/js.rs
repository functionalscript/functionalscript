use crate::{
    nullish::Nullish,
    vm::{IInternalAny, String16},
};

/// ECMAScript functions.
pub trait Js<A: IInternalAny> {
    /// Converts the value to a `String16<A>`.
    /// The function has the same meaning as the `String()` function in JavaScript, see
    /// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String.
    fn string(&self) -> String16<A>;
}

impl<A: IInternalAny> Js<A> for bool {
    fn string(&self) -> String16<A> {
        (match self {
            true => "true",
            false => "false",
        })
        .into()
    }
}

impl<A: IInternalAny> Js<A> for Nullish {
    fn string(&self) -> String16<A> {
        (match self {
            Nullish::Null => "null",
            Nullish::Undefined => "undefined",
        })
        .into()
    }
}

impl<A: IInternalAny> Js<A> for f64 {
    fn string(&self) -> String16<A> {
        self.to_string().as_str().into()
    }
}
