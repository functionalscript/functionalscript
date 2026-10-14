//! The scaffolding the `BigInt` unit tests in this directory share.
//!
//! TODO: unit tests should not use `naive` or any other VM implementation.
//! A test that uses only `BigInt`'s public API, as `int` and `pow2` do, can
//! move out of the crate: to the operator corpus in `fjs/nanvm` when
//! JavaScript has the same case, otherwise to `nanvm/lib/tests/` (see its
//! README). A test that builds a raw representation through `pos` or `neg`,
//! or calls a private function, stays here: `unchecked_new` is private
//! because it can build a value that is not normalized.

use crate::{naive::Naive, sign::Sign};

use super::BigInt;

/// The `BigInt` the tests compute with.
pub type T = BigInt<Naive>;

/// `value` as a `BigInt`.
pub fn int(value: i64) -> T {
    value.into()
}

/// `2^bit`.
pub fn pow2(bit: i64) -> T {
    (int(1) << int(bit)).unwrap()
}

/// The positive `BigInt` whose magnitude is `items`, least significant word
/// first, taken as given: nothing normalizes it.
pub fn pos(items: impl IntoIterator<Item = u64>) -> T {
    T::unchecked_new(Sign::Positive, items)
}

/// The negative `BigInt` whose magnitude is `items`, as [`pos`] takes them.
pub fn neg(items: impl IntoIterator<Item = u64>) -> T {
    T::unchecked_new(Sign::Negative, items)
}
