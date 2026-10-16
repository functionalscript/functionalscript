use crate::vm::{IVm, Unpacked};

/// A value of the VM `A`: what [`Any<A>`](crate::vm::Any) wraps.
///
/// A value is built from an [`Unpacked`] alone, so a number reaches it only
/// as a [`Number`](crate::vm::Number), which holds one `NaN` by
/// construction — there is no `From<f64>` here on purpose — so a NaN-boxing
/// VM, which reads a negative quiet `NaN` as a boxed value, can store its
/// bits as they are.
pub trait IAny<A: IVm>: Sized + Clone + From<Unpacked<A>> {
    fn to_unpacked(self) -> Unpacked<A>;
}
