use core::iter::empty;

use crate::vm::{Array, IVm, ToArray};

impl<A: IVm> Default for Array<A> {
    fn default() -> Self {
        empty().to_array()
    }
}
