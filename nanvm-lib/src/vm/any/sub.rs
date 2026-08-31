use core::ops::Sub;

use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> Sub for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn sub(self, rhs: Self) -> Self::Output {
        Ok(Unpacked::from((self.to_numeric()? - rhs.to_numeric()?)?).into())
    }
}
