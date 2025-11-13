use core::iter::empty;

use super::Object;
use crate::vm::{IVm, ToObject};

impl<A: IVm> Default for Object<A> {
    fn default() -> Self {
        empty().to_object()
    }
}
