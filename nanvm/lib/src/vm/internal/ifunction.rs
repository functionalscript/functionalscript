use crate::vm::{Any, Array, IVm};

use super::IComplex;

/// A function: what a program can do with one, and nothing it cannot.
///
/// A program can call a function, read its `length`, read its text, and
/// compare it by identity. It cannot look inside one — the language has no
/// function constructor, and the text is a rendering of the code, not the
/// code — so how a VM
/// represents a function, a Rust static function, an EDAG it interprets, or
/// both, is the VM's own, and nothing here depends on the choice. There is
/// no constructor here for the same reason: construction is each VM's own
/// capability, [`IStaticFunction`](super::IStaticFunction) for one.
pub trait IFunction<A: IVm>: IComplex<A> {
    fn call(&self, args: Array<A>) -> Result<Any<A>, Any<A>>;
    fn length(&self) -> u32;
    /// The function's text, `String(f)`, or `None` for a function that has
    /// none: see [`IStaticFunction`](super::IStaticFunction).
    fn text(&self) -> Option<&'static str>;
}
