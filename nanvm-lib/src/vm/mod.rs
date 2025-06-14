pub mod internal;
pub mod naive;
pub mod unpacked;

use crate::vm::{internal::{IContainer, IInternalAny}, unpacked::Unpacked};

#[derive(Clone)]
pub struct Any<A: IInternalAny>(pub A);

trait AnyEx {
    fn to_any<A: IInternalAny>(self) -> Any<A>
    where
        Self: Into<A>,
    {
        Any(self.into())
    }
}

impl<T> AnyEx for T {}

impl<A: IInternalAny> From<Unpacked<A>> for Any<A> {
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

#[derive(Clone)]
pub struct String<A: IInternalAny>(pub A::InternalString);

impl<A: IInternalAny> PartialEq for String<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.deep_eq(&other.0)
    }
}

#[derive(Clone)]
pub struct BigInt<A: IInternalAny>(pub A::InternalBigInt);

impl<A: IInternalAny> PartialEq for BigInt<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.deep_eq(&other.0)
    }
}

pub type Property<A> = (String<A>, Any<A>);

#[derive(Clone)]
pub struct Object<A: IInternalAny>(pub A::InternalObject);

impl<A: IInternalAny> PartialEq for Object<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

#[derive(Clone)]
pub struct Array<A: IInternalAny>(pub A::InternalArray);

impl<A: IInternalAny> PartialEq for Array<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

pub type FunctionHeader<A> = (String<A>, u32);

#[derive(Clone)]
pub struct Function<A: IInternalAny>(pub A::InternalFunction);

impl<A: IInternalAny> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}
