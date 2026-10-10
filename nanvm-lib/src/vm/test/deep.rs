//! What the tests of a read over a deeply nested value share: a thread whose
//! stack is far too small for a recursion that follows the nesting, and the
//! values to nest. They retain a leaked root to test traversal separately from
//! `Naive`'s recursive destruction; consuming a sole-owned deep value remains
//! unfinished (see `nanvm-lib/todo/array-deep-nesting.md`).

#[cfg(not(target_family = "wasm"))]
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
#[cfg(not(target_family = "wasm"))]
const STACK: usize = 256 * 1_024;

/// Runs `f` on a thread with [`STACK`]. WebAssembly has no threads, so there it
/// runs on the one stack, which a recursion that follows the nesting overflows
/// all the same.
pub(crate) fn small_stack(f: impl FnOnce() + Send + 'static) {
    #[cfg(target_family = "wasm")]
    f();
    #[cfg(not(target_family = "wasm"))]
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

/// Leaves `a` unreleased. Call with a clone immediately after constructing the
/// root, before any read or assertion can panic. The retained reference prevents
/// `Naive`'s recursive destruction from overflowing the stack during unwinding
/// and hiding the original failure. This does not test sole-owned consumption.
pub(crate) fn leak(a: Any<Naive>) {
    std::mem::forget(a);
}
