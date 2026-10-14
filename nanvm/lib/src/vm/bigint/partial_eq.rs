use crate::vm::{BigInt, IVm};
use std::cmp::Ordering;

/// Equality is defined by [`Ord`] (in `cmp.rs`), the single owner of how two
/// `BigInt`s relate, so `a == b` holds exactly when `a.cmp(&b) == Equal` by
/// construction rather than by two code paths happening to agree.
///
/// Invariant: both operands are normalized — no leading (most-significant)
/// zero words, and zero is always `Sign::Positive` with no words (no negative
/// zero). `Ord` relies on it and panics on a non-normalized operand, which
/// only `unchecked_new` can build.
impl<A: IVm> PartialEq for BigInt<A> {
    fn eq(&self, other: &Self) -> bool {
        self.cmp(other) == Ordering::Equal
    }
}

impl<A: IVm> Eq for BigInt<A> {}
