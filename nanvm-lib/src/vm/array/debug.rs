use crate::vm::{internal::ContainerFmt, Array, IVm};
use core::fmt::{Debug, Formatter, Result};

impl<A: IVm> Debug for Array<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        self.container_fmt('[', ']', f)
    }
}
