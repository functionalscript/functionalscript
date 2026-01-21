use super::{Any, IVm};
use std::ops::Mul;

impl<A: IVm> Mul for Any<A> where <A as IVm>::InternalBigInt: AsRef<[u64]> {
    type Output = Result<Any<A>, Any<A>>;

    fn mul(self, rhs: Self) -> Self::Output {
        self.to_numeric()? * rhs.to_numeric()?
    }
}
