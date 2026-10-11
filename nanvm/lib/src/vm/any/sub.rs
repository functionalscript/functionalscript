use core::ops::Sub;

use crate::vm::{Any, IVm, numeric::Numeric};

impl<A: IVm> Sub for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn sub(self, rhs: Self) -> Self::Output {
        self.numeric_op(rhs, Numeric::sub)
    }
}
