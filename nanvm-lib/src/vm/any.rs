use crate::vm::{IInternalAny, Unpacked};

#[derive(Clone)]
pub struct Any<A: IInternalAny>(pub A);

pub trait ToAnyEx {
    fn to_any<A: IInternalAny>(self) -> Any<A>
    where
        Self: Into<A>,
    {
        Any(self.into())
    }
}

impl<T> ToAnyEx for T {}

/// Same as `===` in ECMAScript.
impl<A: IInternalAny> PartialEq for Any<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.clone().to_unpacked() == other.0.clone().to_unpacked()
    }
}

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
