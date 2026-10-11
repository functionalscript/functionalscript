use core::ops::BitAnd;

use crate::vm::{Any, IVm, numeric::Numeric};

impl<A: IVm> BitAnd for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn bitand(self, rhs: Self) -> Self::Output {
        self.numeric_op(rhs, Numeric::bitand)
    }
}
