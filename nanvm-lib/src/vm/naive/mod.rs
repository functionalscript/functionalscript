mod container;

use crate::{
    sign::Sign,
    vm::{naive::container::Container, Any, FunctionHeader, IVm, Property, Unpacked},
};

/// Note: we can't use `type InternalAny = Unpacked<InternalAny>;` because Rust doesn't support
/// recursive type aliases.
#[derive(Clone)]
pub struct Naive(Unpacked<Naive>);

impl<T: Into<Unpacked<Naive>>> From<T> for Naive {
    fn from(value: T) -> Self {
        Naive(value.into())
    }
}

impl IVm for Naive {
    type InternalString16 = Container<(), u16>;
    type InternalBigInt = Container<Sign, u64>;
    type InternalObject = Container<(), Property<Naive>>;
    type InternalArray = Container<(), Any<Naive>>;
    type InternalFunction = Container<FunctionHeader<Naive>, u8>;

    fn to_unpacked(self) -> Unpacked<Self> {
        self.0
    }
}
