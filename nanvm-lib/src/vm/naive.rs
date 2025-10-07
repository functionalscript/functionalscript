use core::{fmt::Debug, ops::Index};
use std::rc::Rc;

use crate::{
    common::serializable::Serializable,
    sign::Sign,
    vm::{Any, FunctionHeader, IContainer, IVm, Property, Unpacked},
};

/// Note: we can't use `type InternalAny = Unpacked<InternalAny>;` because Rust doesn't support
/// recursive type aliases.
#[derive(Clone)]
pub struct InternalAny(pub Unpacked<InternalAny>);

impl<T: Into<Unpacked<InternalAny>>> From<T> for InternalAny {
    fn from(value: T) -> Self {
        InternalAny(value.into())
    }
}

impl IVm for InternalAny {
    type InternalString16 = Container<(), u16>;
    type InternalBigInt = Container<Sign, u64>;
    type InternalObject = Container<(), Property<InternalAny>>;
    type InternalArray = Container<(), Any<InternalAny>>;
    type InternalFunction = Container<FunctionHeader<InternalAny>, u8>;

    fn to_unpacked(self) -> Unpacked<Self> {
        self.0
    }
}

#[derive(Clone, PartialEq)]
pub struct Container<H, I> {
    header: H,
    items: Rc<[I]>,
}

impl<H, I> Index<u32> for Container<H, I> {
    type Output = I;
    fn index(&self, index: u32) -> &Self::Output {
        &self.items[index as usize]
    }
}

impl<H: Clone + PartialEq + Serializable + 'static, I: Clone + Debug + Serializable + 'static>
    IContainer<InternalAny> for Container<H, I>
{
    type Header = H;
    type Item = I;

    fn new<E>(
        header: Self::Header,
        i: impl IntoIterator<Item = Result<Self::Item, E>>,
    ) -> Result<Self, E> {
        Ok(Self {
            header,
            items: i.into_iter().collect::<Result<_, _>>()?,
        })
    }

    fn header(&self) -> &Self::Header {
        &self.header
    }

    fn len(&self) -> u32 {
        self.items.len() as u32
    }

    fn ptr_eq(&self, other: &Self) -> bool {
        self.header == other.header && Rc::ptr_eq(&self.items, &other.items)
    }
}
