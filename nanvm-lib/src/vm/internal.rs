use crate::{nullish::Nullish, sign::Sign, vm::Unpacked};

pub trait Container<A: Internal>: Sized {
    //
    type Header;
    type Item;
    //
    fn new<E>(header: Self::Header, i: impl IntoIterator<Item = Result<Self::Item, E>>) -> Result<Self, E>;
    fn header(&self) -> &Self::Header;
    fn len(&self) -> usize;
    fn items(&self, i: usize) -> Self::Item;
    //
    fn to_internal(self) -> A;
    // extension:
    fn to_any(self) -> super::Any<A> {
        super::Any(self.to_internal())
    }
}

pub trait String<A: Internal>: Container<A, Header = (), Item = u16> {}

pub trait BigInt<A: Internal>: Container<A, Header = Sign, Item = u64> {}

pub trait Object<A: Internal>: Container<A, Header = (), Item = super::Property<A>> {}

pub trait Array<A: Internal>: Container<A, Header = (), Item = super::Any<A>> {}

pub trait Simple<A: Internal, T> {
    fn to_internal(value: T) -> A;
    // extension:
    fn to_any(value: T) -> super::Any<A> {
        super::Any(Self::to_internal(value))
    }
}

pub trait Internal: Sized + Simple<Self, Nullish> + Simple<Self, bool> + Simple<Self, f64> {
    // types
    type String: String<Self>;
    type BigInt: BigInt<Self>;
    type Object: Object<Self>;
    type Array: Array<Self>;
    //
    fn to_unpacked(&self) -> Unpacked<Self>;
}
