use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> From<Any<A>> for Unpacked<A> {
    fn from(v: Any<A>) -> Self {
        v.0.to_unpacked()
    }
}
