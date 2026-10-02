//! What the tests of a read over a deeply nested value share: a thread whose
//! stack is far too small for a recursion that follows the nesting, and the
//! values to nest.

use std::thread;

use crate::{
    naive::Naive,
    vm::{Any, String, ToAny, ToArray, ToObject},
};

/// How deep the values nest: far past what a recursion over them survives on
/// [`STACK`], at 944 levels for the deepest of the reads that were recursive.
pub(crate) const DEPTH: usize = 100_000;

/// A stack a tenth of the default's: a recursion that follows the nesting
/// overflows it within a thousand levels.
const STACK: usize = 256 * 1024;

/// Runs `f` on a thread with [`STACK`].
pub(crate) fn small_stack(f: impl FnOnce() + Send + 'static) {
    thread::Builder::new()
        .stack_size(STACK)
        .spawn(f)
        .unwrap()
        .join()
        .unwrap();
}

/// `leaf` in `depth` arrays, one inside the next.
pub(crate) fn nested_arrays(depth: usize, leaf: Any<Naive>) -> Any<Naive> {
    (0..depth).fold(leaf, |a, _| [a].to_array().to_any())
}

/// `leaf` in `depth` objects, one inside the next, each under the key `"a"`.
pub(crate) fn nested_objects(depth: usize, leaf: Any<Naive>) -> Any<Naive> {
    (0..depth).fold(leaf, |a, _| {
        [(String::<Naive>::from("a"), a)].to_object().to_any()
    })
}

/// Leaves `a` unreleased. These tests are about the read, and a value this deep
/// is not always dropped without recursion: whether a drop is safe is
/// [`Naive`]'s own business, tested there.
pub(crate) fn leak(a: Any<Naive>) {
    std::mem::forget(a);
}
