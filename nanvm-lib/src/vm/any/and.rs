use crate::vm::{Any, IVm};

impl<A: IVm> Any<A> {
    /// `&&`. Not a `core::ops` trait — Rust's own `&&` takes `bool` operands
    /// and short-circuits on `bool`, neither of which fits an operator over
    /// an `Any<A>` — so this is a plain method, the same as `unary_plus`.
    ///
    /// Returns `self` unchanged if it coerces to `false` via `ToBoolean`,
    /// otherwise establishes `rhs` and returns its value. `rhs` is a thunk
    /// because JavaScript establishes the right operand only when the left
    /// decides nothing: `false && (1n / 0n)` is `false`, not a throw. A
    /// by-value operand would already have been established by the caller,
    /// which is why the signature, not the caller, carries the laziness —
    /// generated code cannot spell the eager call at all. `FnOnce`, since
    /// the operand is established at most once; a `Result`, since
    /// establishing it may throw, and that throw is this operation's.
    /// <https://tc39.es/ecma262/#sec-binary-logical-operators>
    pub fn logical_and(self, rhs: impl FnOnce() -> Result<Self, Self>) -> Result<Self, Self> {
        if self.clone().to_boolean() {
            rhs()
        } else {
            Ok(self)
        }
    }
}
