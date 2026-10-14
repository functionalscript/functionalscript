use super::Any;
use crate::vm::{IVm, Unpacked};

pub trait ToAny {
    fn to_any<A: IVm>(self) -> Any<A>
    where
        Self: Into<Unpacked<A>>,
    {
        let unpacked: Unpacked<A> = self.into();
        Any(unpacked.into())
    }
}

impl<T> ToAny for T {}
