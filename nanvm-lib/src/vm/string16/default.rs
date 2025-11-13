use core::iter;

use crate::vm::{IVm, String16, ToString16};

impl<A: IVm> Default for String16<A> {
    fn default() -> Self {
        iter::empty().to_string16()
    }
}
