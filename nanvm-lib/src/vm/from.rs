use crate::{
    nullish::Nullish,
    vm::{Any, Array, BigInt, Function, IVm, Object, String16, ToAny, ToString16, Unpacked},
};

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

impl<A: IVm> From<&str> for Any<A> {
    fn from(value: &str) -> Self {
        let s: String16<_> = value.into();
        s.to_any()
    }
}

impl<A: IVm> From<&str> for String16<A> {
    fn from(value: &str) -> Self {
        value.encode_utf16().to_string16()
    }
}

// TODO: Should we use `TryFrom` instead since we can have an error?
impl<A: IVm> From<String16<A>> for String {
    fn from(value: String16<A>) -> Self {
        char::decode_utf16(value)
            .map(|r| r.unwrap_or(char::REPLACEMENT_CHARACTER))
            .collect()
    }
}

impl<A: IVm> From<Nullish> for Unpacked<A> {
    fn from(value: Nullish) -> Self {
        Unpacked::Nullish(value)
    }
}

impl<A: IVm> From<bool> for Unpacked<A> {
    fn from(value: bool) -> Self {
        Unpacked::Boolean(value)
    }
}
impl<A: IVm> From<f64> for Unpacked<A> {
    fn from(value: f64) -> Self {
        Unpacked::Number(value)
    }
}

impl<A: IVm> From<String16<A>> for Unpacked<A> {
    fn from(value: String16<A>) -> Self {
        Unpacked::String(value)
    }
}

impl<A: IVm> From<BigInt<A>> for Unpacked<A> {
    fn from(value: BigInt<A>) -> Self {
        Unpacked::BigInt(value)
    }
}

impl<A: IVm> From<Object<A>> for Unpacked<A> {
    fn from(value: Object<A>) -> Self {
        Unpacked::Object(value)
    }
}

impl<A: IVm> From<Array<A>> for Unpacked<A> {
    fn from(value: Array<A>) -> Self {
        Unpacked::Array(value)
    }
}

impl<A: IVm> From<Function<A>> for Unpacked<A> {
    fn from(value: Function<A>) -> Self {
        Unpacked::Function(value)
    }
}
