use super::BigInt;
use crate::{common::default::default, sign::Sign, vm::IVm};

impl<A: IVm> From<u64> for BigInt<A> {
    fn from(value: u64) -> Self {
        if value == 0 {
            return default();
        }
        Self::new_one(Sign::Positive, value)
    }
}

impl<A: IVm> From<i64> for BigInt<A> {
    fn from(value: i64) -> Self {
        if value >= 0 {
            return (value as u64).into();
        }
        Self::new_one(Sign::Negative, value.overflowing_neg().0 as u64)
    }
}
