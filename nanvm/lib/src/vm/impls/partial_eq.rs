use crate::vm::{IVm, Unpacked, impls::unpack, numeric::Numeric, primitive::Primitive};

impl<A: IVm> PartialEq for Unpacked<A> {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Nullish(a), Self::Nullish(b)) => a == b,
            (Self::Boolean(a), Self::Boolean(b)) => a == b,
            (Self::Number(a), Self::Number(b)) => a == b,
            (Self::String(a), Self::String(b)) => a == b,
            (Self::BigInt(a), Self::BigInt(b)) => a == b,
            (Self::Object(a), Self::Object(b)) => a == b,
            (Self::Array(a), Self::Array(b)) => a == b,
            (Self::Function(a), Self::Function(b)) => a == b,
            _ => false,
        }
    }
}

impl<A: IVm> PartialEq for Primitive<A> {
    fn eq(&self, other: &Self) -> bool {
        unpack(self) == unpack(other)
    }
}

impl<A: IVm> PartialEq for Numeric<A> {
    fn eq(&self, other: &Self) -> bool {
        unpack(self) == unpack(other)
    }
}
