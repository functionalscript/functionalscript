use crate::vm::{Any, IVm};

impl<A: IVm> Any<A> {
    /// `?:`. Not a `core::ops` trait — Rust has no operator for a ternary
    /// conditional (`if`/`else` takes a `bool`, not an `Any<A>`) — so this
    /// is a plain method, the same as `logical_and`/`logical_or`.
    ///
    /// Coerces `self` via `ToBoolean` and selects `consequent` or
    /// `alternate` unchanged. Never throws, but stays a `Result` to match
    /// every other operator's shape.
    /// <https://tc39.es/ecma262/#sec-conditional-operator>
    pub fn conditional(self, consequent: Self, alternate: Self) -> Result<Self, Self> {
        Ok(if self.to_boolean() {
            consequent
        } else {
            alternate
        })
    }
}
