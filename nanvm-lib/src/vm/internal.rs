use crate::{nullish::Nullish, sign::Sign, vm::{FunctionHeader, Unpacked}};

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
    Sized + Clone +
    From<Nullish> +
    From<bool> +
    From<f64> +
    From<Self::String> +
    From<Self::BigInt> +
    From<Self::Object> +
    From<Self::Array> +
    From<Self::Function>
{
    // types
    type String: IContainer<Self, Header = (), Item = u16>;
    type BigInt: IContainer<Self, Header = Sign, Item = u64>;
    type Object: IContainer<Self, Header = (), Item = super::Property<Self>>;
    type Array: IContainer<Self, Header = (), Item = super::Any<Self>>;
    type Function: IContainer<Self, Header = FunctionHeader<Self>, Item = u8>;
    //
    fn to_unpacked(self) -> Unpacked<Self>;
}
