use crate::{
    common::{
        array::{RandomAccess, SizedIndex},
        serializable::Serializable,
    },
    nullish::Nullish,
    sign::Sign,
    vm::{Any, Array, BigInt, Function, FunctionHeader, Object, Property, String16, Unpacked},
};

use core::{
    fmt::{Debug, Formatter, Write},
    iter,
    marker::PhantomData,
};
use std::io;

pub struct ContainerIterator<A: IVm, C: IContainer<A>> {
    container: C,
    i: usize,
    _p: PhantomData<A>,
}

impl<A: IVm, C: IContainer<A>> Iterator for ContainerIterator<A, C> {
    type Item = C::Item;
    fn next(&mut self) -> Option<Self::Item> {
        let i = self.i;
        let items = self.container.items();
        if i < items.length() {
            self.i += 1;
            Some(items[i].clone())
        } else {
            None
        }
    }
}

pub trait IContainer<A: IVm>: Sized + Clone + 'static {
    // types
    type Header: PartialEq + Serializable + Clone;
    type Item: Debug + Serializable + Clone;
    type Items: RandomAccess<Output = Self::Item> + ?Sized;

    // functions
    fn new<E>(
        header: Self::Header,
        i: impl IntoIterator<Item = Result<Self::Item, E>>,
    ) -> Result<Self, E>;
    fn header(&self) -> &Self::Header;
    fn items(&self) -> &Self::Items;
    fn ptr_eq(&self, other: &Self) -> bool;

    // extensions

    fn is_empty(&self) -> bool {
        self.items().length() == 0
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

        let a = self.items();
        let b = b.items();
        a.to_iter().eq(b.to_iter())
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
        let items = self.items();
        for i in 0..items.length() {
            if i != 0 {
                f.write_char(',')?;
            }
            items[i].fmt(f)?;
        }
        f.write_char(close)
    }

    fn serialize(self, write: &mut impl io::Write) -> io::Result<()> {
        self.header().clone().serialize(write)?;
        (self.items().length() as u32).serialize(write)?;
        for i in self.items_iter() {
            i.serialize(write)?;
        }
        Ok(())
    }

    fn deserialize(read: &mut impl io::Read) -> io::Result<Self> {
        let header = Self::Header::deserialize(read)?;
        let mut len = u32::deserialize(read)?;
        let i = iter::from_fn(|| {
            if len > 0 {
                len -= 1;
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
