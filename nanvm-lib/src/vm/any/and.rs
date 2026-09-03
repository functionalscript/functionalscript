use crate::vm::{Any, IVm};

impl<A: IVm> Any<A> {
    /// `&&`. Not a `core::ops` trait — Rust's own `&&` takes `bool` operands
    /// and short-circuits *evaluation*, neither of which fits an operator
    /// over two already-evaluated `Any<A>` values — so this is a plain
    /// method, the same as `unary_plus`.
    ///
    /// Returns `self` unchanged if it coerces to `false` via `ToBoolean`,
    /// otherwise `rhs` unchanged. Never throws, but stays a `Result` to
    /// match every other binary operator's shape.
    /// <https://tc39.es/ecma262/#sec-binary-logical-operators>
    pub fn logical_and(self, rhs: Self) -> Result<Self, Self> {
        Ok(if self.clone().to_boolean() { rhs } else { self })
    }
}
