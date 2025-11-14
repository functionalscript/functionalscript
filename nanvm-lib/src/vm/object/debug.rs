use core::fmt::{Debug, Formatter, Result};

use crate::vm::{IContainer, IVm, Object};

impl<A: IVm> Debug for Object<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        self.0.items_fmt('{', '}', f)
    }
}
