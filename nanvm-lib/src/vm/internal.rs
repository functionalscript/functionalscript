use crate::{
    common::serializable::Serializable,
    nullish::Nullish,
    sign::Sign,
    vm::{Any, Array, BigInt, Function, FunctionHeader, Object, Property, String16, Unpacked},
};

use std::{
    fmt::{Debug, Formatter, Write},
    io, iter,
    marker::PhantomData,
};

pub struct ContainerIterator<A: IVm, C: IContainer<A>> {
    container: C,
    i: u32,
    _p: PhantomData<A>,
}

impl<A: IVm, C: IContainer<A>> Iterator for ContainerIterator<A, C> {
    type Item = C::Item;
    fn next(&mut self) -> Option<Self::Item> {
        let i = self.i;
        if i < self.container.len() {
            self.i += 1;
            Some(self.container.at(i))
        } else {
            None
        }
    }
}

pub trait IContainer<A: IVm>: Sized + Clone + 'static {
    // types
    type Header: PartialEq + Serializable;
    type Item: Debug + Serializable;

    // functions
    fn new<E>(
        header: Self::Header,
        i: impl IntoIterator<Item = Result<Self::Item, E>>,
    ) -> Result<Self, E>;
    fn header(&self) -> &Self::Header;
    fn len(&self) -> u32;
    fn at(&self, i: u32) -> Self::Item;
    fn ptr_eq(&self, other: &Self) -> bool;

    // extensions

    fn is_empty(&self) -> bool {
        self.len() == 0
    }

    fn new_ok(header: Self::Header, i: impl IntoIterator<Item = Self::Item>) -> Self {
        Self::new::<()>(header, i.into_iter().map(Ok)).unwrap()
    }

    fn new_empty(header: Self::Header) -> Self {
        Self::new_ok(header, iter::empty())
    }

    fn items_eq(&self, b: &Self) -> bool
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
        true
    }

    fn items_iter(self) -> ContainerIterator<A, Self>
    where
        Self::Item: Clone,
    {
        ContainerIterator {
            container: self,
            i: 0,
            _p: PhantomData,
        }
    }

    fn items_fmt(&self, open: char, close: char, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_char(open)?;
        for i in 0..self.len() {
            if i > 0 {
                f.write_char(',')?;
            }
            self.at(i).fmt(f)?;
        }
        f.write_char(close)
    }

    fn serialize(&self, write: &mut impl io::Write) -> io::Result<()> {
        self.header().serialize(write)?;
        let len = self.len();
        len.serialize(write)?;
        for i in 0..len {
            self.at(i).serialize(write)?;
        }
        Ok(())
    }

    fn deserialize(read: &mut impl io::Read) -> io::Result<Self> {
        let header = Self::Header::deserialize(read)?;
        let mut rem = u32::deserialize(read)?;
        let i = iter::from_fn(|| {
            if rem > 0 {
                rem -= 1;
                Some(Self::Item::deserialize(read))
            } else {
                None
            }
        });
        Self::new(header, i)
    }
}

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
