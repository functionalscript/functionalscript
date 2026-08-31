use core::ops::Neg;

use crate::vm::{Any, IVm, Unpacked};

impl<A: IVm> Neg for Any<A> {
    type Output = Result<Any<A>, Any<A>>;
    fn neg(self) -> Self::Output {
        // https://tc39.es/ecma262/#sec-unary-minus-operator
        Ok(Unpacked::from(-self.to_numeric()?).into())
    }
}

#[cfg(test)]
mod test {

    #[test]
    fn test_neg_zero() {
        let z = 0.0f64;
        let nz = -z;
        assert_ne!(z.to_bits(), nz.to_bits());
    }
}
