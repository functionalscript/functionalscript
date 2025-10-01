use super::{Any, IVm};

pub trait ToAnyEx {
    fn to_any<A: IVm>(self) -> Any<A>
    where
        Self: Into<A>,
    {
        Any(self.into())
    }
}

impl<T> ToAnyEx for T {}
