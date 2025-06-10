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

pub trait IComplex<A: IInternalAny>: IContainer<A> {
    fn to_internal(self) -> A;
    // extension:
    fn to_any(self) -> super::Any<A> {
        super::Any(self.to_internal())
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
    Sized + Clone + ISimple<Self, Nullish> + ISimple<Self, bool> + ISimple<Self, f64>
{
    // types
    type String: IComplex<Self, Header = (), Item = u16>;
    type BigInt: IComplex<Self, Header = Sign, Item = u64>;
    type Object: IComplex<Self, Header = (), Item = super::Property<Self>>;
    type Array: IComplex<Self, Header = (), Item = super::Any<Self>>;
    type Function: IComplex<Self, Header = FunctionHeader<Self>, Item = u8>;
    //
    fn to_unpacked(self) -> Unpacked<Self>;
}
