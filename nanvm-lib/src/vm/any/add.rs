use std::ops::Add;

use crate::vm::{Any, IVm};

impl<A: IVm> Add for Any<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        // TODO: implement according the standard
        (self.0.clone().to_unpacked() + rhs.0.clone().to_unpacked()).into()
    }
}
