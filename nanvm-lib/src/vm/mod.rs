pub mod internal;
pub mod naive;
pub mod unpacked;

use crate::vm::{internal::IInternalAny, unpacked::Unpacked};

#[derive(Clone)]
pub struct Any<A: IInternalAny>(pub A);

trait ToAny {
    fn to_any<A: IInternalAny>(self) -> Any<A> where Self: Into<A> {
        Any(self.into())
    }
}

impl<T> ToAny for T {}

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

#[derive(Clone)]
pub struct BigInt<A: IInternalAny>(pub A::InternalBigInt);

pub type Property<A> = (String<A>, Any<A>);

#[derive(Clone)]
pub struct Object<A: IInternalAny>(pub A::InternalObject);

#[derive(Clone)]
pub struct Array<A: IInternalAny>(pub A::InternalArray);

pub type FunctionHeader<A> = (String<A>, u32);

#[derive(Clone)]
pub struct Function<A: IInternalAny>(pub A::InternalFunction);
