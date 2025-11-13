use crate::vm::{Array, IContainer, IVm};
use core::fmt::{Debug, Formatter, Result};

impl<A: IVm> Debug for Array<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        self.0.items_fmt('[', ']', f)
    }
}
