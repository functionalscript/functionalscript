use crate::vm::{Any, Array, Function, IVm};

/// The code of a static function.
///
/// One signature for every function, whether or not its body reads `self_`:
/// the VM's own value the function is the code of, through which the body
/// reads its frame, [`IStaticFunction::frame`], and names itself for
/// recursion, `Function::new(self_.clone())`, an `Rc`-cheap clone of the same
/// value. The arguments come by value, as every operator on `Any` takes its
/// operands.
pub type StaticCode<A> =
    fn(self_: &<A as IVm>::InternalFunction, args: Array<A>) -> Result<Any<A>, Any<A>>;

/// A VM that makes a function out of a Rust static function.
///
/// Generated and hand-written code that constructs functions bounds on this
/// trait where it would bound on [`IVm`] alone.
pub trait IStaticFunction: IVm {
    fn static_function(code: StaticCode<Self>, length: u32, frame: Array<Self>) -> Function<Self>;
    /// The frame `static_function` was given, read by the code through its `self_`.
    fn frame(self_: &Self::InternalFunction) -> &Array<Self>;
}
