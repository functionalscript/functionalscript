use core::ops::Rem;

use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> Rem for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn rem(self, rhs: Self) -> Self::Output {
        Ok(Unpacked::from((self.to_numeric()? % rhs.to_numeric()?)?).into())
    }
}
