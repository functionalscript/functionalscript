use std::ops::Mul;

use crate::vm::{Any, IVm};

impl<A: IVm> Mul for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn mul(self, rhs: Self) -> Self::Output {
        self.to_numeric()? * rhs.to_numeric()?
    }
}
