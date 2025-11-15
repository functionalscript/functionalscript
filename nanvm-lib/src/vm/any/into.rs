use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> Into<Unpacked<A>> for Any<A> {
    fn into(self) -> Unpacked<A> {
        self.0.to_unpacked()
    }
}
