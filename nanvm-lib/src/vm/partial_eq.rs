use crate::vm::{Any, Array, BigInt, Function, IContainer, IVm, Object, String16, Unpacked};

/// Same as `===` in ECMAScript.
impl<A: IVm> PartialEq for Any<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.clone().to_unpacked() == other.0.clone().to_unpacked()
    }
}

impl<A: IVm> PartialEq for Array<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IVm> PartialEq for Object<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IVm> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IVm> PartialEq for BigInt<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.items_eq(&other.0)
    }
}

impl<A: IVm> PartialEq for String16<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.items_eq(&other.0)
    }
}

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
