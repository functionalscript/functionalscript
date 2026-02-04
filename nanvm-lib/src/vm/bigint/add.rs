use core::ops::Add;

use crate::vm::{BigInt, IContainer, IVm};

impl<A: IVm> Add for BigInt<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {

        let mut sign = self.0.header();
        let mut value = with_default(0 as usize);

        if self.0.header() == rhs.0.header() {
            Self::new(
                self.0.header(),
                BigUint::add(self.items(), rhs.items()).value,
            )
        } else {
            match self.items().cmp(other.items()) {
                Ordering::Equal => Self::zero(),
                Ordering::Greater => Self::new(
                    *self.header(),
                    BigUint::sub(self.items(), other.items()).value,
                ),
                Ordering::Less => Self::new(
                    *other.header(),
                    BigUint::sub(other.items(), self.items()).value,
                ),
            }
        }
    }
}