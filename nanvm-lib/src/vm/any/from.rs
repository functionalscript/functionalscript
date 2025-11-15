use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> From<Any<A>> for Unpacked<A> {
    fn from(value: Any<A>) -> Self {
        value.0.to_unpacked()
    }
}
