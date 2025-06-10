use crate::{
    nullish::Nullish,
    sign::Sign,
    vm::{Array, BigInt, Function, FunctionHeader, Object, String, Unpacked},
};

pub trait IContainer<A: IInternalAny>: Sized + Clone {
    //
    type Header;
    type Item;
    //
    fn new<E>(
        header: Self::Header,
        i: impl IntoIterator<Item = Result<Self::Item, E>>,
    ) -> Result<Self, E>;
    fn header(&self) -> &Self::Header;
    fn len(&self) -> usize;
    fn at(&self, i: usize) -> Self::Item;
    // extension:
    fn is_empty(&self) -> bool {
        self.len() == 0
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
    type InternalObject: IContainer<Self, Header = (), Item = super::Property<Self>>;
    type InternalArray: IContainer<Self, Header = (), Item = super::Any<Self>>;
    type InternalFunction: IContainer<Self, Header = FunctionHeader<Self>, Item = u8>;
    //
    fn to_unpacked(self) -> Unpacked<Self>;
}
