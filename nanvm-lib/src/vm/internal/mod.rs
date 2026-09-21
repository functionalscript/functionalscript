mod icontainer;

pub use icontainer::IContainer;

use crate::{
    sign::Sign,
    vm::{
        Any, Array, BigInt, Function, FunctionHeader, Number, Object, Property, String, Unpacked,
        nullish::Nullish,
    },
};

/// A VM's value representation.
///
/// A number reaches a VM only as a [`Number`], which holds one `NaN` by
/// construction — there is no `From<f64>` here on purpose — so a NaN-boxing
/// VM, which reads a negative quiet `NaN` as a boxed value, can store its
/// bits as they are.
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
    type InternalFunction: IContainer<Self, Header = FunctionHeader<Self>, Item = u8>;
    // functions
    fn to_unpacked(self) -> Unpacked<Self>;
}
