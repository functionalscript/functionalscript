use crate::vm::{Any, Array, IVm};

/// The static Rust code of a module function or a runtime closure.
///
/// A runtime closure reads its captures through [`IVm::frame`] and can
/// refer to itself with `Function::new(self_.clone())`. A compiled descriptor
/// body names its captured constants and its own descriptor directly.
/// Both receive the arguments by value.
pub type StaticCode<A> =
    fn(self_: &<A as IVm>::InternalFunction, args: Array<A>) -> Result<Any<A>, Any<A>>;

/// A compiled member of a runtime function group. Its code reads the group's
/// shared frame through `IVm::frame` and its siblings through `IVm::group_member`.
pub struct GroupEntry<A: IVm> {
    pub code: StaticCode<A>,
    pub length: u32,
    pub text: Option<&'static str>,
}

/// A VM that makes a function out of a Rust static function: every VM,
/// since [`IVm::static_function`] is the capability itself. The name is
/// what compiled modules and the runtime's member functions bound on, each
/// a maker of functions, kept as the one spelling of that requirement where
/// a bound on [`IVm`] alone would say less about what the code does.
pub trait IStaticFunction: IVm {}

impl<A: IVm> IStaticFunction for A {}
