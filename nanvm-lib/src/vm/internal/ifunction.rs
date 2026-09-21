use crate::vm::{Any, Array, IVm};

use super::IComplex;

/// A function: what a program can do with one, and nothing it cannot.
///
/// A program can call a function, read its `length`, and compare it by
/// identity. It cannot look inside one — the language has no function
/// constructor and no way to read a function's code — so how a VM
/// represents a function, a Rust static function, an EDAG it interprets, or
/// both, is the VM's own, and nothing here depends on the choice. There is
/// no constructor here for the same reason: construction is each VM's own
/// capability, [`IStaticFunction`](super::IStaticFunction) for one.
pub trait IFunction<A: IVm>: IComplex<A> {
    fn call(&self, args: Array<A>) -> Result<Any<A>, Any<A>>;
    fn length(&self) -> u32;
}
