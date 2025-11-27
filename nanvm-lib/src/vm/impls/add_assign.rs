use core::ops::AddAssign;

use crate::vm::{IVm, String};

impl<A: IVm> AddAssign for String<A> {
    fn add_assign(&mut self, other: Self) {
        *self = self.clone() + other;
    }
}
