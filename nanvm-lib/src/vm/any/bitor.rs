use core::ops::BitOr;

use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> BitOr for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn bitor(self, rhs: Self) -> Self::Output {
        Ok(Unpacked::from((self.to_numeric()? | rhs.to_numeric()?)?).into())
    }
}
