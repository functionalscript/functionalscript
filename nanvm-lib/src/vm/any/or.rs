use crate::vm::{Any, IVm};

impl<A: IVm> Any<A> {
    /// `||`. Not a `core::ops` trait, for the same reason as `logical_and`.
    ///
    /// Returns `self` unchanged if it coerces to `true` via `ToBoolean`,
    /// otherwise `rhs` unchanged.
    /// <https://tc39.es/ecma262/#sec-binary-logical-operators>
    pub fn logical_or(self, rhs: Self) -> Result<Self, Self> {
        Ok(if self.clone().to_boolean() { self } else { rhs })
    }
}
