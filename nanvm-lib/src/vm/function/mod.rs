mod debug;
mod partial_eq;

use crate::vm::{Any, Array, IFunction, IVm};

/// A function value: it can be called, it has a `length`, and it has an
/// identity — `PartialEq` compares by reference. Nothing else: the internal
/// value stays private, and the one way in is [`Function::new`], from a VM's
/// own value, which a VM constructs through its own capability, such as
/// [`IStaticFunction`](crate::vm::IStaticFunction).
#[derive(Clone)]
pub struct Function<A: IVm>(A::InternalFunction);

impl<A: IVm> Function<A> {
    /// An inherent constructor rather than `From<A::InternalFunction>`: that
    /// impl would overlap core's `From<T> for T`, since a VM may choose
    /// `InternalFunction = Function<A>`.
    pub fn new(internal: A::InternalFunction) -> Self {
        Function(internal)
    }
    pub fn call(&self, args: Array<A>) -> Result<Any<A>, Any<A>> {
        self.0.call(args)
    }
    pub fn length(&self) -> u32 {
        self.0.length()
    }
}
