use core::ops::Add;

use crate::vm::{IVm, String16, ToString16};

impl<A: IVm> Add for String16<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        self.into_iter().chain(rhs).to_string16()
    }
}
