use crate::vm::{Function, IVm};
use core::fmt::{Debug, Formatter, Result};

/// A fixed marker: `Debug` is a Rust diagnostic, not a program value, so it
/// carries no text a program could observe.
impl<A: IVm> Debug for Function<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.write_str("[Function]")
    }
}
