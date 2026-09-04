use core::ops::Shl;

use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> Shl for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn shl(self, rhs: Self) -> Self::Output {
        Ok(Unpacked::from((self.to_numeric()? << rhs.to_numeric()?)?).into())
    }
}
