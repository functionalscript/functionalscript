use crate::vm::{container_fmt::ContainerFmt, Any, Array, IVm, Unpacked};
use core::fmt::{Debug, Formatter, Result};

impl<A: IVm> Debug for Any<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        let u: Unpacked<_> = self.clone().into();
        u.fmt(f)
    }
}

impl<A: IVm> Debug for Array<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        self.container_fmt('[', ']', f)
    }
}
