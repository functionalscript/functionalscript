use crate::vm::{Any, IVm};
use core::fmt::{Debug, Formatter, Result};

impl<A: IVm> Debug for Any<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        self.0.clone().to_unpacked().fmt(f)
    }
}
