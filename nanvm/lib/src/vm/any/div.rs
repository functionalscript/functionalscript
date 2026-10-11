use core::ops::Div;

use crate::vm::{Any, IVm, numeric::Numeric};

impl<A: IVm> Div for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn div(self, rhs: Self) -> Self::Output {
        self.numeric_op(rhs, Numeric::div)
    }
}
