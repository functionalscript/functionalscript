mod icontainer;

pub use icontainer::IContainer;

use crate::{
    sign::Sign,
    vm::{
        Any, Array, BigInt, Function, FunctionHeader, Object, Property, String, Unpacked,
        nullish::Nullish,
    },
};

/// A VM's value representation.
///
/// A VM owes what `Unpacked::number` gives, wherever it packs a number: every
/// `NaN` is the one canonical `NaN`, since the language has one and a
/// NaN-boxing VM reads a negative quiet `NaN` as a boxed value. `Unpacked`'s
/// conversions from an `f64` canonicalize, but `Unpacked::Number` is a public
/// variant a caller can build with any bits, so the VM's own `From` is where
/// the invariant holds — `Naive`'s does — and one that packs an `f64` itself
/// canonicalizes it first.
pub trait IVm:
    Sized
    + Clone
    + From<Nullish>
    + From<bool>
    + From<f64>
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
