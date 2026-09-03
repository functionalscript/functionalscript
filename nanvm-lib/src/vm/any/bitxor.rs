use core::ops::BitXor;

use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> BitXor for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn bitxor(self, rhs: Self) -> Self::Output {
        Ok(Unpacked::from((self.to_numeric()? ^ rhs.to_numeric()?)?).into())
    }
}
