use super::Any;
use crate::vm::IVm;

pub trait ToAny {
    fn to_any<A: IVm>(self) -> Any<A>
    where
        Self: Into<A>,
    {
        Any(self.into())
    }
}

impl<T> ToAny for T {}
