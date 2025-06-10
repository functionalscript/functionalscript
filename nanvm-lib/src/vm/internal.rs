use crate::{nullish::Nullish, sign::Sign, vm::Unpacked};

pub trait Container<A: Internal>: Sized + Clone {
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

pub trait Complex<A: Internal>: Container<A> {
    fn to_internal(self) -> A;
    // extension:
    fn to_any(self) -> super::Any<A> {
        super::Any(self.to_internal())
    }
}

pub trait String<A: Internal>: Complex<A, Header = (), Item = u16> {}

pub trait BigInt<A: Internal>: Complex<A, Header = Sign, Item = u64> {}

pub trait Object<A: Internal>: Complex<A, Header = (), Item = super::Property<A>> {}

pub trait Array<A: Internal>: Complex<A, Header = (), Item = super::Any<A>> {}

pub type FunctionHeader<A> = (super::String<A>, u32);

pub trait Function<A: Internal>: Complex<A, Header = FunctionHeader<A>, Item = u8> {}

pub trait Simple<A: Internal, T> {
    fn to_internal(value: T) -> A;
    // extension:
    fn to_any(value: T) -> super::Any<A> {
        super::Any(Self::to_internal(value))
    }
}

pub trait Internal:
    Sized + Clone + Simple<Self, Nullish> + Simple<Self, bool> + Simple<Self, f64>
{
    // types
    type String: String<Self>;
    type BigInt: BigInt<Self>;
    type Object: Object<Self>;
    type Array: Array<Self>;
    type Function: Function<Self>;
    //
    fn to_unpacked(self) -> Unpacked<Self>;
}
