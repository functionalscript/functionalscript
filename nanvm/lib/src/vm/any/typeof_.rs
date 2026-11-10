use crate::vm::{Any, IVm, Nullish, Unpacked};

impl<A: IVm> Any<A> {
    /// `typeof`. Not a `core::ops` trait — Rust has no unary operator to
    /// spell it with — so this is a plain method, the same as `unary_plus`.
    /// Named `typeof_`, not `type_of`: `typeof` is itself a reserved word, and
    /// a trailing underscore — the convention FJS and JS both use for this —
    /// resolves the collision while keeping the name recognizable. Never
    /// throws, but stays a `Result` to match every other operator's shape.
    /// <https://tc39.es/ecma262/#sec-typeof-operator>
    pub fn typeof_(&self) -> Result<Any<A>, Any<A>> {
        let tag = self.with_unpacked(|v| match v {
            Unpacked::Nullish(Nullish::Undefined) => "undefined",
            Unpacked::Boolean(_) => "boolean",
            Unpacked::Number(_) => "number",
            Unpacked::String(_) => "string",
            Unpacked::BigInt(_) => "bigint",
            // `null` is famously an object in JavaScript's `typeof`.
            Unpacked::Nullish(Nullish::Null) | Unpacked::Object(_) | Unpacked::Array(_) => "object",
            Unpacked::Function(_) => "function",
        });
        Ok(tag.into())
    }
}
