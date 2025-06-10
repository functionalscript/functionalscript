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

pub trait ISimple<A: IInternalAny, T> {
    fn to_internal(value: T) -> A;
    // extension:
    fn to_any(value: T) -> super::Any<A> {
        super::Any(Self::to_internal(value))
    }
}

pub trait IInternalAny:
    Sized + Clone +
    ISimple<Self, Nullish> +
    ISimple<Self, bool> +
    ISimple<Self, f64> +
    ISimple<Self, Self::String> +
    ISimple<Self, Self::BigInt> +
    ISimple<Self, Self::Object> +
    ISimple<Self, Self::Array> +
    ISimple<Self, Self::Function>
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
