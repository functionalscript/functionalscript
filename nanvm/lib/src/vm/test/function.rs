//! The function values the tests of a call need, named for what they do so a
//! test reads as what the callee does — answers its arguments, a constant, or
//! throws — rather than as how a function value is built.

use crate::{
    naive::Naive,
    vm::{Any, IVm, ToAny, ToArray},
};

type A = Naive;

/// The runtime value a call step takes.
pub(crate) fn rt() -> Any<A> {
    crate::vm::runtime::<A>().unwrap()
}

/// An empty arguments array, for a call that takes none.
pub(crate) fn no_args() -> Result<Any<A>, Any<A>> {
    Ok([].to_array().to_any())
}

/// A function that answers its arguments, as the array it was given.
pub(crate) fn identity() -> Any<A> {
    A::static_function(|_, args| Ok(args.to_any()), 0, [].to_array(), None).to_any()
}

/// `() => v`, answering its frame's one item.
pub(crate) fn returns(v: Any<A>) -> Any<A> {
    A::static_function(
        |self_, _| Ok(A::frame(self_)[0].clone()),
        0,
        [v].to_array(),
        None,
    )
    .to_any()
}

/// `() => { throw v }`, throwing its frame's one item.
pub(crate) fn throws(v: Any<A>) -> Any<A> {
    A::static_function(
        |self_, _| Err(A::frame(self_)[0].clone()),
        0,
        [v].to_array(),
        None,
    )
    .to_any()
}
