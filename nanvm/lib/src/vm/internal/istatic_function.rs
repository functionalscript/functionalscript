use crate::vm::{Any, Array, IVm};

/// The code of a static function.
///
/// One signature for every function, whether or not its body reads `self_`:
/// the VM's own value the function is the code of, through which the body
/// reads its frame, [`IVm::frame`], and names itself for recursion,
/// `Function::new(self_.clone())`, an `Rc`-cheap clone of the same value.
/// The arguments come by value, as every operator on `Any` takes its
/// operands.
pub type StaticCode<A> =
    fn(self_: &<A as IVm>::InternalFunction, args: Array<A>) -> Result<Any<A>, Any<A>>;

/// A VM that makes a function out of a Rust static function: every VM,
/// since [`IVm::static_function`] is the capability itself. The name is
/// what compiled modules and the runtime's member functions bound on, each
/// a maker of functions, kept as the one spelling of that requirement where
/// a bound on [`IVm`] alone would say less about what the code does.
pub trait IStaticFunction: IVm {}

impl<A: IVm> IStaticFunction for A {}
