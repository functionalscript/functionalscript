use std::io;

use crate::{nullish::Nullish, vm::Unpacked};

pub trait Container<A: Any>: Sized {
    //
    type Header;
    type Item;
    //
    fn new(header: Self::Header, i: impl IntoIterator<Item = io::Result<Self::Item>>) -> io::Result<Self>;
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

pub trait String<A: Any>: Container<A, Header = (), Item = u16> {}

pub trait BigInt<A: Any>: Container<A, Header = i64, Item = u64> {}

pub trait Object<A: Any>: Container<A, Header = (), Item = super::Property<A>> {}

pub trait Array<A: Any>: Container<A, Header = (), Item = super::Any<A>> {}

pub trait Simple<A: Any, T> {
    fn to_internal(value: T) -> A;
    // extension:
    fn from_simple(value: T) -> super::Any<A> {
        super::Any(Self::to_internal(value))
    }
}

pub trait Any: Sized + Simple<Self, Nullish> + Simple<Self, bool> + Simple<Self, f64> {
    // types
    type String: String<Self>;
    type BigInt: BigInt<Self>;
    type Object: Object<Self>;
    type Array: Array<Self>;
    //
    fn unpack(&self) -> Unpacked<Self>;
}
