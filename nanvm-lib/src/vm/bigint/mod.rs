mod debug;
mod default;
mod from;
mod index;
mod mul;
mod neg;
mod partial_eq;
mod serializable;
mod sized_index;

use core::iter::once;

use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{IContainer, IVm},
};

/// ```
/// use nanvm_lib::vm::{BigInt, IVm, naive::Naive};
/// fn bigint_test<A: IVm>() {
///     let a: BigInt<A> = 12345678901234567890u64.into();
///     let b: BigInt<A> = (-1234567890123456789i64).into();
/// }
///
/// bigint_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct BigInt<A: IVm>(A::InternalBigInt);

impl<A: IVm> BigInt<A> {
    fn is_zero(&self) -> bool {
        self.0.items().is_empty()
    }
    fn new(sign: Sign, items: impl IntoIterator<Item = u64>) -> Self {
        Self(A::InternalBigInt::new_ok(sign, items))
    }
    fn new_one(sign: Sign, value: u64) -> Self {
        Self::new(sign, once(value))
    }
}
