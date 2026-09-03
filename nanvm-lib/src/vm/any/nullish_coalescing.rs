use crate::vm::{Any, IVm, Nullish};

impl<A: IVm> Any<A> {
    /// `??`. Not a `core::ops` trait — `?` is Rust's own try-operator and
    /// unrelated to this — so this is a plain method, the same as
    /// `logical_and`/`logical_or`.
    ///
    /// Returns `rhs` if `self` is `null` or `undefined`, otherwise `self`
    /// unchanged — unlike `logical_and`/`logical_or`, this keys off
    /// nullishness rather than `ToBoolean`, so a falsy-but-not-nullish
    /// `self` (`0`, `NaN`, `""`, ...) is still returned unchanged.
    /// <https://tc39.es/ecma262/#sec-binary-logical-operators>
    pub fn nullish_coalescing(self, rhs: Self) -> Result<Self, Self> {
        Ok(match Nullish::try_from(self.clone()) {
            Ok(_) => rhs,
            Err(_) => self,
        })
    }
}
