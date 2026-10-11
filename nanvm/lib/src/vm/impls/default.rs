use core::iter::empty;

use crate::vm::{Array, IVm, Object, String, ToArray, ToObject, ToString};

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

impl<A: IVm> Default for String<A> {
    fn default() -> Self {
        empty().to_string()
    }
}
