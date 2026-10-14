use super::Any;
use crate::vm::{IVm, Unpacked};

impl<A: IVm> From<Any<A>> for Unpacked<A> {
    fn from(v: Any<A>) -> Self {
        v.0.to_unpacked()
    }
}

impl<A: IVm> From<Unpacked<A>> for Any<A> {
    fn from(value: Unpacked<A>) -> Self {
        Any(value.into())
    }
}
