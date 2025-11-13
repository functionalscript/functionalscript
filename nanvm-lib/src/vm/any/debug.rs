use crate::vm::{Any, IVm, Unpacked};
use core::fmt::{Debug, Formatter, Result};

impl<A: IVm> Debug for Any<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        let u: Unpacked<_> = self.clone().into();
        u.fmt(f)
    }
}
