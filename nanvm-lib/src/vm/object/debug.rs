use core::fmt::{self, Debug, Formatter};

use crate::vm::{IContainer, IVm, Object};

impl<A: IVm> Debug for Object<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        self.0.items_fmt('{', '}', f)
    }
}
