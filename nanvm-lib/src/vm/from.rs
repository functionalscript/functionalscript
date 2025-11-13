use std::string::String;

use crate::{
    common::default::default,
    nullish::Nullish,
    sign::Sign,
    vm::{
        internal::IContainer, naive::Naive, Any, Array, BigInt, Function, IVm, Object, String16,
        ToAny, ToString16, Unpacked,
    },
};

impl<T: Into<Unpacked<Naive>>> From<T> for Naive {
    fn from(value: T) -> Self {
        Naive(value.into())
    }
}

impl<A: IVm> From<Any<A>> for Unpacked<A> {
    fn from(value: Any<A>) -> Self {
        value.0.to_unpacked()
    }
}

impl<A: IVm> From<Unpacked<A>> for Any<A> {
    fn from(value: Unpacked<A>) -> Self {
        match value {
            Unpacked::Nullish(n) => n.to_any(),
            Unpacked::Boolean(b) => b.to_any(),
            Unpacked::Number(n) => n.to_any(),
            Unpacked::String(s) => s.to_any(),
            Unpacked::BigInt(i) => i.to_any(),
            Unpacked::Object(o) => o.to_any(),
            Unpacked::Array(a) => a.to_any(),
            Unpacked::Function(f) => f.to_any(),
        }
    }
}

impl<A: IVm> From<Nullish> for Unpacked<A> {
    fn from(value: Nullish) -> Self {
        Self::Nullish(value)
    }
}

impl<A: IVm> From<bool> for Unpacked<A> {
    fn from(value: bool) -> Self {
        Self::Boolean(value)
    }
}

impl<A: IVm> From<f64> for Unpacked<A> {
    fn from(value: f64) -> Self {
        Self::Number(value)
    }
}

impl<A: IVm> From<String16<A>> for Unpacked<A> {
    fn from(value: String16<A>) -> Self {
        Self::String(value)
    }
}

impl<A: IVm> From<BigInt<A>> for Unpacked<A> {
    fn from(value: BigInt<A>) -> Self {
        Self::BigInt(value)
    }
}

impl<A: IVm> From<Object<A>> for Unpacked<A> {
    fn from(value: Object<A>) -> Self {
        Self::Object(value)
    }
}

impl<A: IVm> From<Array<A>> for Unpacked<A> {
    fn from(value: Array<A>) -> Self {
        Self::Array(value)
    }
}

impl<A: IVm> From<Function<A>> for Unpacked<A> {
    fn from(value: Function<A>) -> Self {
        Self::Function(value)
    }
}

impl<A: IVm> From<&str> for String16<A> {
    fn from(value: &str) -> Self {
        value.encode_utf16().to_string16()
    }
}

impl<A: IVm> From<&str> for Any<A> {
    fn from(value: &str) -> Self {
        let s: String16<_> = value.into();
        s.to_any()
    }
}

impl<A: IVm> From<String16<A>> for String {
    fn from(value: String16<A>) -> Self {
        char::decode_utf16(value)
            .map(|r| r.unwrap_or(char::REPLACEMENT_CHARACTER))
            .collect()
    }
}

impl<A: IVm> From<u64> for BigInt<A> {
    fn from(value: u64) -> Self {
        if value == 0 {
            return default();
        }
        BigInt(A::InternalBigInt::new_ok(Sign::Positive, [value]))
    }
}

impl<A: IVm> From<i64> for BigInt<A> {
    fn from(value: i64) -> Self {
        if value == 0 {
            return default();
        }
        let (sign, v) = if value < 0 {
            (Sign::Negative, value.overflowing_neg().0 as u64)
        } else {
            (Sign::Positive, value as u64)
        };
        BigInt(A::InternalBigInt::new_ok(sign, [v]))
    }
}
