use crate::vm::{Any, IVm};

impl<A: IVm> Any<A> {
    /// `?:`. Not a `core::ops` trait — Rust has no operator for a ternary
    /// conditional (`if`/`else` takes a `bool`, not an `Any<A>`) — so this
    /// is a plain method, the same as `logical_and`/`logical_or`.
    ///
    /// Coerces `self` via `ToBoolean`, establishes the arm that selects —
    /// `consequent` or `alternate` — and returns its value. The arms are
    /// thunks because JavaScript establishes exactly one of them:
    /// `true ? 1 : (1n / 0n)` is `1`, not a throw. `FnOnce`, since an arm is
    /// established at most once; a `Result`, since establishing it may
    /// throw, and that throw is this operation's.
    /// <https://tc39.es/ecma262/#sec-conditional-operator>
    pub fn conditional(
        self,
        consequent: impl FnOnce() -> Result<Self, Self>,
        alternate: impl FnOnce() -> Result<Self, Self>,
    ) -> Result<Self, Self> {
        if self.to_boolean() {
            consequent()
        } else {
            alternate()
        }
    }
}
