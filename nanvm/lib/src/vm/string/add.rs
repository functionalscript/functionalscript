use core::ops::{Add, AddAssign};

use crate::vm::{IVm, String, ToString};

impl<A: IVm> Add for String<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        self.into_iter().chain(rhs).to_string()
    }
}

impl<A: IVm> AddAssign for String<A> {
    fn add_assign(&mut self, other: Self) {
        *self = self.clone() + other;
    }
}
