use super::{Any, IVm};
use std::ops::Mul;

impl<A: IVm> Mul for Any<A> {
    type Output = Result<Any<A>, Any<A>>;

    fn mul(self, rhs: Self) -> Self::Output {
        let lhs = self.to_numeric();
        let rhs = rhs.to_numeric();

        match (lhs, rhs) {
            (Ok(lhs_val), Ok(rhs_val)) => lhs_val * rhs_val,
            (Err(e), _) | (_, Err(e)) => Err(e),
        }
    }
}
