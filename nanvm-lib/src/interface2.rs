use crate::{sign::Sign, simple::Simple};

pub trait Container {
    type Header;
    type Item;
    fn header(&self) -> &Self::Header;
    /// For now, we use a slice.
    /// We may change it in the future to support more sophisticated containers.
    fn items(&self) -> &[Self::Item];
    fn new(header: Self::Header, items: impl IntoIterator<Item = Self::Item>) -> Self;
}

pub trait Complex<U: Unknown>: PartialEq + Sized + Container {
    fn to_unknown(self) -> U;
    fn try_from_unknown(u: U) -> Result<Self, U>;
}

pub trait String16<U: Unknown<String16 = Self>>: Complex<U> + Container<Header = (), Item = u16> {}

pub trait BigInt<U: Unknown<BigInt = Self>>: Complex<U> + Container<Header = Sign, Item = u64> {}

pub trait Array<U: Unknown<Array = Self>>: Complex<U> + Container<Header = (), Item = U> {}

pub trait Object<U: Unknown<Object = Self>>: Complex<U> + Container<Header = (), Item = (U::String16, U)> {}

pub trait Function<U: Unknown<Function = Self>>: Complex<U> + Container<Header = u32, Item = u8> {}

pub trait Unknown: PartialEq + Sized
{
    type String16: String16<Self>;
    type BigInt: BigInt<Self>;
    type Array: Array<Self>;
    type Object: Object<Self>;
    type Function: Function<Self>;

    fn new_simple(value: Simple) -> Self;
    fn try_to_simple(&self) -> Option<Simple>;

    fn try_to<C: Complex<Self>>(self) -> Result<C, Self> {
        C::try_from_unknown(self)
    }
}

trait Extension: Sized {
    fn to_complex<C: Complex<impl Unknown> + Container<Header = ()>>(self) -> C
    where
        Self: IntoIterator<Item = C::Item>,
    {
        C::new((), self)
    }

    fn to_string16<U: Unknown>(self) -> U
    where
        Self: IntoIterator<Item = u16>,
    {
        self.to_complex::<U::String16>().to_unknown()
    }
    fn to_array<U: Unknown>(self) -> U
    where
        Self: IntoIterator<Item = U>
    {
        self.to_complex::<U::Array>().to_unknown()
    }
    fn to_object<U: Unknown>(self) -> U
    where
        Self: IntoIterator<Item = (U::String16, U)>
    {
        self.to_complex::<U::Object>().to_unknown()
    }
}

impl<T> Extension for T {}
