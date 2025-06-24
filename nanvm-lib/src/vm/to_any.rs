use crate::vm::{Any, IInternalAny};

pub trait ToAnyEx {
    fn to_any<A: IInternalAny>(self) -> Any<A>
    where
        Self: Into<A>,
    {
        Any(self.into())
    }
}

impl<T> ToAnyEx for T {}
