use crate::{nullish::Nullish, sign::Sign};

trait SimpleUnknown<T> {
    fn new(value: T) -> Self;
    fn try_to(&self) -> Option<T>;
}

trait Complex<U: Unknown>: PartialEq + Sized {
    type Item;
    fn to_unknown(self) -> U;
    fn try_from_unknown(u: U) -> Result<Self, U>;
    /// For now, we use a slice.
    /// We may change it in the future to support more sophisticated containers.
    fn items(&self) -> &[Self::Item];
}

trait NoHeader<U: Unknown>: Complex<U> {
    fn new(items: impl IntoIterator<Item = Self::Item>) -> Self;
}

trait WithHeader<U: Unknown>: Complex<U> {
    type Header;
    fn header(&self) -> Self::Header;
    fn new(header: Self::Header, items: impl IntoIterator<Item = Self::Item>) -> Self;
}

trait String16<U: Unknown<String16 = Self>>: NoHeader<U, Item = u16> {}

trait BigInt<U: Unknown<BigInt = Self>>: WithHeader<U, Header = Sign, Item = u64> {}

trait Array<U: Unknown<Array = Self>>: NoHeader<U, Item = U> {}

trait Object<U: Unknown<Object = Self>>: NoHeader<U, Item = (U::String16, U)> {}

trait Function<U: Unknown<Function = Self>>: WithHeader<U, Header = u32, Item = u8> {}

trait Unknown:
    PartialEq + Sized + SimpleUnknown<Nullish> + SimpleUnknown<bool> + SimpleUnknown<f64>
{
    type String16: String16<Self>;
    type BigInt: BigInt<Self>;
    type Array: Array<Self>;
    type Object: Object<Self>;
    type Function: Function<Self>;

    fn try_to<C: Complex<Self>>(self) -> Result<C, Self> {
        C::try_from_unknown(self)
    }
}

trait Extension: Sized {
    fn from_simple<U: SimpleUnknown<Self>>(self) -> U {
        U::new(self)
    }

    fn to_complex<C: NoHeader<impl Unknown>>(self) -> C
    where
        Self: IntoIterator<Item = C::Item>,
    {
        C::new(self)
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
