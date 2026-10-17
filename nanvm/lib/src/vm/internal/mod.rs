mod icomplex;
mod icontainer;
mod ifunction;
mod istatic_function;

pub use icomplex::IComplex;
pub use icontainer::IContainer;
pub use ifunction::IFunction;
pub use istatic_function::{IStaticFunction, StaticCode};

use crate::{
    sign::Sign,
    vm::{Any, Property, Unpacked},
};

/// A VM's value representation.
///
/// A VM is built from an [`Unpacked`] value alone, so a number reaches it
/// only as a [`Number`](crate::vm::Number), which holds one `NaN` by
/// construction — there is no `From<f64>` here on purpose — so a NaN-boxing
/// VM, which reads a negative quiet `NaN` as a boxed value, can store its
/// bits as they are.
///
/// A VM is `'static`: a type with no lifetime, which a built-in's
/// descriptor names behind a `'static` reference
/// ([`RuntimeFunction`](crate::vm::RuntimeFunction)). The runtime is not
/// the VM's to bind: every built-in is a static function of the compiled
/// runtime, which a call step and a compiled read reach for any VM
/// ([`runtime_method`](crate::vm::runtime_method),
/// [`runtime_static`](crate::vm::runtime_static)).
pub trait IVm: Sized + Clone + From<Unpacked<Self>> + 'static {
    // types
    type InternalString: IContainer<Self, Header = (), Item = u16>;
    type InternalBigInt: IContainer<Self, Header = Sign, Item = u64>;
    type InternalObject: IContainer<Self, Header = (), Item = Property<Self>>;
    type InternalArray: IContainer<Self, Header = (), Item = Any<Self>>;
    type InternalFunction: IFunction<Self>;
    // functions
    fn to_unpacked(self) -> Unpacked<Self>;
}
