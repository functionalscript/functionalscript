use super::BigInt;
use crate::{
    common::default::default,
    sign::Sign,
    vm::{IContainer, IVm},
};

impl<A: IVm> From<u64> for BigInt<A> {
    fn from(value: u64) -> Self {
        if value == 0 {
            return default();
        }
        BigInt(A::InternalBigInt::new_ok(Sign::Positive, [value]))
    }
}

impl<A: IVm> From<i64> for BigInt<A> {
    fn from(value: i64) -> Self {
        if value == 0 {
            return default();
        }
        let (sign, v) = if value < 0 {
            (Sign::Negative, value.overflowing_neg().0 as u64)
        } else {
            (Sign::Positive, value as u64)
        };
        BigInt(A::InternalBigInt::new_ok(sign, [v]))
    }
}
