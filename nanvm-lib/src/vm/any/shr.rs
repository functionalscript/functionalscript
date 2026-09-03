use core::ops::Shr;

use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> Shr for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn shr(self, rhs: Self) -> Self::Output {
        Ok(Unpacked::from((self.to_numeric()? >> rhs.to_numeric()?)?).into())
    }
}
