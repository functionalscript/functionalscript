use core::ops::BitXor;

use crate::vm::{Any, IVm, numeric::Numeric};

impl<A: IVm> BitXor for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn bitxor(self, rhs: Self) -> Self::Output {
        self.numeric_op(rhs, Numeric::bitxor)
    }
}
