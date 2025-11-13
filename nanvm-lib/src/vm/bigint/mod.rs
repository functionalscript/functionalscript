use crate::vm::{IContainer, IVm};

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
pub struct BigInt<A: IVm>(pub(crate) A::InternalBigInt);

impl<A: IVm> BigInt<A> {
    pub(crate) fn is_zero(&self) -> bool {
        self.0.is_empty()
    }
}
