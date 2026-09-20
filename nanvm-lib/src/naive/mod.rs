mod container;

use crate::{
    naive::container::Container,
    sign::Sign,
    vm::{Any, FunctionHeader, IVm, Property, Unpacked},
};

/// Note: we can't use `type InternalAny = Unpacked<InternalAny>;` because Rust doesn't support
/// recursive type aliases.
#[derive(Clone)]
pub struct Naive(Unpacked<Naive>);

impl<T: Into<Unpacked<Naive>>> From<T> for Naive {
    /// Packs a value, canonicalizing a `NaN` on the way in: `Unpacked`'s own
    /// conversions already do, but `Unpacked::Number` is a public variant a
    /// caller can build with any bits, and the VM is what owes the invariant.
    fn from(value: T) -> Self {
        Naive(match value.into() {
            Unpacked::Number(n) => Unpacked::number(n),
            v => v,
        })
    }
}

impl IVm for Naive {
    type InternalString = Container<(), u16>;
    type InternalBigInt = Container<Sign, u64>;
    type InternalObject = Container<(), Property<Naive>>;
    type InternalArray = Container<(), Any<Naive>>;
    type InternalFunction = Container<FunctionHeader<Naive>, u8>;

    fn to_unpacked(self) -> Unpacked<Self> {
        self.0
    }
}
