use crate::{
    nullish::Nullish,
    sign::Sign,
    vm::{Any, Array, BigInt, Function, FunctionHeader, Object, Property, String, Unpacked},
};

use std::fmt::{Debug, Formatter, Write};

pub trait IContainer<A: IInternalAny>: Sized + Clone {
    // types
    type Header;
    type Item: Debug;

    // functions
    fn new<E>(
        header: Self::Header,
        i: impl IntoIterator<Item = Result<Self::Item, E>>,
    ) -> Result<Self, E>;
    fn header(&self) -> &Self::Header;
    fn len(&self) -> usize;
    fn at(&self, i: usize) -> Self::Item;
    fn ptr_eq(&self, other: &Self) -> bool;

    // extensions

    fn is_empty(&self) -> bool {
        self.len() == 0
    }

    fn deep_eq(&self, b: &Self) -> bool
    where
        Self::Header: PartialEq,
        Self::Item: PartialEq,
    {
        if self.header() != b.header() {
            return false;
        }
        let len = self.len();
        if len != b.len() {
            return false;
        }
        for i in 0..len {
            if self.at(i) != b.at(i) {
                return false;
            }
        }
        return true;
    }

    fn collect(&self) -> Vec<Self::Item>
    where
        Self::Item: Clone,
    {
        (0..self.len()).map(|i| self.at(i)).collect()
    }

    fn items_fmt(&self, open: char, close: char, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_char(open)?;
        let mut first = true;
        for i in 0..self.len() {
            if !first {
                f.write_char(',')?;
            }
            self.at(i).fmt(f)?;
            first = false;
        }
        f.write_char(close)
    }
}

pub trait IInternalAny:
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
