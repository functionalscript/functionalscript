use std::ops::Mul;

use crate::vm::{Any, IVm, numeric::Numeric};

impl<A: IVm> Mul for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn mul(self, rhs: Self) -> Self::Output {
        self.numeric_op(rhs, Numeric::mul)
    }
}
