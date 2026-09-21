use crate::vm::{Any, IVm};

impl<A: IVm> Any<A> {
    /// `||`. Not a `core::ops` trait, for the same reason as `logical_and`,
    /// and `rhs` is a thunk for the same reason: the right operand is
    /// established only if `self` coerces to `false` via `ToBoolean`.
    ///
    /// Returns `self` unchanged if it coerces to `true`, otherwise
    /// establishes `rhs` and returns its value.
    /// <https://tc39.es/ecma262/#sec-binary-logical-operators>
    pub fn logical_or(self, rhs: impl FnOnce() -> Result<Self, Self>) -> Result<Self, Self> {
        if self.clone().to_boolean() {
            Ok(self)
        } else {
            rhs()
        }
    }
}
