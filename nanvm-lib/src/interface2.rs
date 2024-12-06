use crate::nullish::Nullish;

trait SimpleUnknown<T> {
    fn new(value: T) -> Self;
    fn try_to(&self) -> Option<T>;
}

trait Complex<U: Unknown>: Sized {
    fn to_unknown(self) -> U;
    fn try_from_unknown(u: U) -> Option<Self>;
}

trait String16<U: Unknown<String16 = Self>>: Complex<U> {}

trait BigInt<U: Unknown<BigInt = Self>>: Complex<U> {}

trait Array<U: Unknown<Array = Self>>: Complex<U> {}

trait Object<U: Unknown<Object = Self>>: Complex<U> {}

trait Function<U: Unknown<Function = Self>>: Complex<U> {}

trait Unknown: Sized + SimpleUnknown<Nullish> + SimpleUnknown<bool> + SimpleUnknown<f64> {
    type String16: String16<Self>;
    type BigInt: BigInt<Self>;
    type Array: Array<Self>;
    type Object: Object<Self>;
    type Function: Function<Self>;
}
