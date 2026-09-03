use crate::vm::{
    Any, Array, BigInt, Function, IVm, Object, String, dispatch::Dispatch, nullish::Nullish,
};

/// The tag `Any::type_of` returns, one per `Unpacked` variant.
struct TypeOf;

impl<A: IVm> Dispatch<A> for TypeOf {
    type Result = &'static str;

    fn nullish(self, v: Nullish) -> Self::Result {
        match v {
            // `null` is famously an object in JavaScript's `typeof`.
            Nullish::Null => "object",
            Nullish::Undefined => "undefined",
        }
    }

    fn bool(self, _: bool) -> Self::Result {
        "boolean"
    }

    fn number(self, _: f64) -> Self::Result {
        "number"
    }

    fn string(self, _: String<A>) -> Self::Result {
        "string"
    }

    fn bigint(self, _: BigInt<A>) -> Self::Result {
        "bigint"
    }

    fn object(self, _: Object<A>) -> Self::Result {
        "object"
    }

    fn array(self, _: Array<A>) -> Self::Result {
        "object"
    }

    fn function(self, _: Function<A>) -> Self::Result {
        "function"
    }
}

impl<A: IVm> Any<A> {
    /// `typeof`. Not a `core::ops` trait — Rust has no unary operator to
    /// spell it with (and `typeof` itself is a reserved word) — so this is a
    /// plain method, the same as `unary_plus`. Never throws, but stays a
    /// `Result` to match every other operator's shape.
    /// <https://tc39.es/ecma262/#sec-typeof-operator>
    pub fn type_of(self) -> Result<Any<A>, Any<A>> {
        Ok(self.dispatch(TypeOf).into())
    }
}
