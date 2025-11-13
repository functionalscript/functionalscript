mod icontainer;

pub use icontainer::{ContainerIterator, IContainer};

use crate::{
    nullish::Nullish,
    sign::Sign,
    vm::{Any, Array, BigInt, Function, FunctionHeader, Object, Property, String16, Unpacked},
};

pub trait IVm:
    Sized
    + Clone
    + From<Nullish>
    + From<bool>
    + From<f64>
    + From<String16<Self>>
    + From<BigInt<Self>>
    + From<Object<Self>>
    + From<Array<Self>>
    + From<Function<Self>>
{
    // types
    type InternalString16: IContainer<Self, Header = (), Item = u16>;
    type InternalBigInt: IContainer<Self, Header = Sign, Item = u64>;
    type InternalObject: IContainer<Self, Header = (), Item = Property<Self>>;
    type InternalArray: IContainer<Self, Header = (), Item = Any<Self>>;
    type InternalFunction: IContainer<Self, Header = FunctionHeader<Self>, Item = u8>;
    // functions
    fn to_unpacked(self) -> Unpacked<Self>;
}
