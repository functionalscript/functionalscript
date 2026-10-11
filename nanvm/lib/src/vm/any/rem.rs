use core::ops::Rem;

use crate::vm::{Any, IVm, numeric::Numeric};

impl<A: IVm> Rem for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn rem(self, rhs: Self) -> Self::Output {
        self.numeric_op(rhs, Numeric::rem)
    }
}
