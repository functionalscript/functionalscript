use core::ops::Div;

use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> Div for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn div(self, rhs: Self) -> Self::Output {
        Ok(Unpacked::from((self.to_numeric()? / rhs.to_numeric()?)?).into())
    }
}
