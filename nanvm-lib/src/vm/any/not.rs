use core::ops::Not;

use crate::vm::{Any, IVm, ToAny};

/// `!`. Coerces via `ToBoolean` and negates. Never throws — `ToBoolean`
/// itself cannot fail — but stays a `Result` to match every other
/// operator's shape.
/// <https://tc39.es/ecma262/#sec-logical-not-operator>
impl<A: IVm> Not for Any<A> {
    type Output = Result<Any<A>, Any<A>>;
    fn not(self) -> Self::Output {
        Ok((!self.to_boolean()).to_any())
    }
}
