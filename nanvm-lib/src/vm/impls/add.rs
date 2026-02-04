use core::ops::Add;

use crate::vm::{IVm, String, ToString};

impl<A: IVm> Add for String<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        self.into_iter().chain(rhs).to_string()
    }
}

