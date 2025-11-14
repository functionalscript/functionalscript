use core::ops::AddAssign;

use crate::vm::{IVm, String16};

impl<A: IVm> AddAssign for String16<A> {
    fn add_assign(&mut self, other: Self) {
        *self = self.clone() + other;
    }
}
