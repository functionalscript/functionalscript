use core::fmt::{Debug, Formatter, Result};

use crate::vm::{internal::ContainerFmt, IVm, Object};

impl<A: IVm> Debug for Object<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        self.container_fmt('{', '}', f)
    }
}
