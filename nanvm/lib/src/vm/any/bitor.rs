use core::ops::BitOr;

use crate::vm::{Any, IVm, numeric::Numeric};

impl<A: IVm> BitOr for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn bitor(self, rhs: Self) -> Self::Output {
        self.numeric_op(rhs, Numeric::bitor)
    }
}
