use crate::{nullish::Nullish, sign::Sign};

trait SimpleUnknown<T> {
    fn new(value: T) -> Self;
    fn try_to(&self) -> Option<T>;
}

trait Collection: IntoIterator {}

trait Complex<U: Unknown>: PartialEq + Sized {
    type Header;
    type Item;
    type Collection: Collection<Item = Self::Item>;
    fn to_unknown(self) -> U;
    fn try_from_unknown(u: U) -> Option<Self>;
    fn header(&self) -> Self::Header;
    fn data(&self) -> &Self::Collection;
    fn new(header: Self::Header, items: impl IntoIterator<Item = Self::Item>) -> Self;
}

trait List<U: Unknown>: Complex<U, Header = ()> {
    fn new(items: impl IntoIterator<Item = Self::Item>) -> Self {
        <Self as Complex<U>>::new((), items)
    }
}

trait String16<U: Unknown<String16 = Self>>: List<U, Item = u16> {}

trait BigInt<U: Unknown<BigInt = Self>>: Complex<U, Header = Sign, Item = u64> {}

trait Array<U: Unknown<Array = Self>>: List<U, Item = U> {}

trait Object<U: Unknown<Object = Self>>: List<U, Item = (U::String16, U)> {}

trait Function<U: Unknown<Function = Self>>: Complex<U, Header = u32, Item = u8> {}

trait Unknown:
    PartialEq + Sized + SimpleUnknown<Nullish> + SimpleUnknown<bool> + SimpleUnknown<f64>
{
    type String16: String16<Self>;
    type BigInt: BigInt<Self>;
    type Array: Array<Self>;
    type Object: Object<Self>;
    type Function: Function<Self>;
}
