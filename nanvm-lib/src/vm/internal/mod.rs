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
    vm::{
        Any, Array, BigInt, Function, Number, Object, Property, String, Unpacked, nullish::Nullish,
    },
};

/// A VM's value representation.
///
/// A number reaches a VM only as a [`Number`], which holds one `NaN` by
/// construction — there is no `From<f64>` here on purpose — so a NaN-boxing
/// VM, which reads a negative quiet `NaN` as a boxed value, can store its
/// bits as they are.
///
/// **Dropping a value must not abort, whatever its depth.** A program can
/// build a value a million levels deep and then let it go, and the VM's
/// answer is not allowed to be a stack overflow, which `sandbox` cannot
/// capture and JavaScript's collector never produces. A representation that
/// frees a container's items by recursion bounds that recursion itself, as
/// `naive`'s `Drop` does.
pub trait IVm:
    Sized
    + Clone
    + From<Nullish>
    + From<bool>
    + From<Number>
    + From<String<Self>>
    + From<BigInt<Self>>
    + From<Object<Self>>
    + From<Array<Self>>
    + From<Function<Self>>
{
    // types
    type InternalString: IContainer<Self, Header = (), Item = u16>;
    type InternalBigInt: IContainer<Self, Header = Sign, Item = u64>;
    type InternalObject: IContainer<Self, Header = (), Item = Property<Self>>;
    type InternalArray: IContainer<Self, Header = (), Item = Any<Self>>;
    type InternalFunction: IFunction<Self>;
    // functions
    fn to_unpacked(self) -> Unpacked<Self>;
}
