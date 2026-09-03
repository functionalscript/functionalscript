use core::ops::BitAnd;

use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> BitAnd for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn bitand(self, rhs: Self) -> Self::Output {
        Ok(Unpacked::from((self.to_numeric()? & rhs.to_numeric()?)?).into())
    }
}
