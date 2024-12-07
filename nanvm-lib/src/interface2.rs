use crate::{nullish::Nullish, sign::Sign};

trait SimpleUnknown<T> {
    fn new(value: T) -> Self;
    fn try_to(&self) -> Option<T>;
}

trait Collection<U: Unknown>: PartialEq + Sized {
    type Item;
    fn to_unknown(self) -> U;
    fn try_from_unknown(u: U) -> Result<Self, U>;
    /// For now, we use a slice.
    /// We may change it in the future to support more sophisticated containers.
    fn items(&self) -> &[Self::Item];
}

trait NoHeader<U: Unknown>: Collection<U> {
    fn new(items: impl IntoIterator<Item = Self::Item>) -> Self;
}

trait WithHeader<U: Unknown>: Collection<U> {
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

    fn try_to<C: Collection<Self>>(self) -> Result<C, Self> {
        C::try_from_unknown(self)
    }
}

trait ToUnknown: Sized {
    fn to_unknown<U: SimpleUnknown<Self>>(self) -> U {
        U::new(self)
    }
}

impl<T> ToUnknown for T {}
