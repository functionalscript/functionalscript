use core::iter::empty;

use crate::vm::{Array, IVm, Object, String16, ToArray, ToObject, ToString16};

impl<A: IVm> Default for Array<A> {
    fn default() -> Self {
        empty().to_array()
    }
}

impl<A: IVm> Default for Object<A> {
    fn default() -> Self {
        empty().to_object()
    }
}

impl<A: IVm> Default for String16<A> {
    fn default() -> Self {
        empty().to_string16()
    }
}
