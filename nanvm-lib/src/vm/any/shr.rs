use core::ops::Shr;

use crate::vm::{Any, IVm, numeric::Numeric};

impl<A: IVm> Shr for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn shr(self, rhs: Self) -> Self::Output {
        self.numeric_op(rhs, Numeric::shr)
    }
}
