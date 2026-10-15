mod debug;
mod default;
mod from;
mod into_iterator;
mod partial_eq;
mod try_from;

use crate::vm::{IVm, Unpacked};

/// `value` as the `Unpacked<A>` it converts into: how a subset of
/// `Unpacked` (`Primitive`, `Numeric`) reaches `Unpacked`'s `Debug` and
/// `PartialEq` instead of deriving its own, which would bound `A` itself.
fn unpack<A: IVm, T: Clone + Into<Unpacked<A>>>(value: &T) -> Unpacked<A> {
    value.clone().into()
}
