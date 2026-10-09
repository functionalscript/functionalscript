use core::ops::Shl;

use crate::vm::{Any, IVm, numeric::Numeric};

impl<A: IVm> Shl for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn shl(self, rhs: Self) -> Self::Output {
        self.numeric_op(rhs, Numeric::shl)
    }
}
