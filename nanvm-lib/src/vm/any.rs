use crate::{
    nullish::Nullish,
    vm::{IInternalAny, Unpacked},
};
use std::fmt::{Debug, Formatter};

#[derive(Clone)]
pub struct Any<A: IInternalAny>(pub A);

impl<A: IInternalAny> Debug for Any<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "({:?})", self.0.clone().to_unpacked())
    }
}

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

impl<A: IInternalAny> TryFrom<Any<A>> for Nullish {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Nullish(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for bool {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Boolean(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for f64 {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Number(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}
