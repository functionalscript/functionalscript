use std::io;

use crate::{nullish::Nullish, vm::Unpacked};

pub trait Container<A>: Sized {
    //
    type Header;
    type Item;
    //
    fn new(header: Self::Header, i: impl IntoIterator<Item = io::Result<Self::Item>>) -> io::Result<Self>;
    fn header(&self) -> &Self::Header;
    fn len(&self) -> usize;
    fn items(&self, i: usize) -> Self::Item;
    //
    fn to_any(self) -> A;
}

pub trait String<A>: Container<A, Header = (), Item = u16> {}

pub trait BigInt<A>: Container<A, Header = i64, Item = u64> {}

pub trait Object<A: Any>: Container<A, Header = (), Item = super::Property<A>> {}

pub trait Array<A: Any>: Container<A, Header = (), Item = super::Any<A>> {}

pub trait Any: Sized {
    // types
    type String: String<Self>;
    type BigInt: BigInt<Self>;
    type Object: Object<Self>;
    type Array: Array<Self>;
    //
    fn unpack(&self) -> Unpacked<Self>;
    fn from_nullish(v: Nullish) -> Self;
    fn from_boolean(v: bool) -> Self;
    fn from_number(number: f64) -> Self;
}
