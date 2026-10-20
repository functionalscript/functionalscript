//! One `From<X> for Unpacked<A>` per payload type, written by hand on
//! purpose; `try_from.rs` holds the matching `TryFrom<Any<A>> for X`.
//!
//! A sealed helper trait (`nanvm/lib/AGENTS.md` §2.1, rung 1) carrying each
//! type's variant can derive only the `From` half: with a `Sealed`
//! supertrait, `impl<A, T: Variant<A>> From<T> for Unpacked<A>` compiles,
//! but `impl<A, T: Variant<A>> TryFrom<Any<A>> for T` breaks the orphan rule
//! (E0210), so each type keeps a concrete `TryFrom`. Every type would then
//! carry a `Variant` impl (its wrap and its unwrap) and a `TryFrom` that
//! delegates to it, which is longer than these impls and removes no
//! per-type code; a `build.rs` table (rung 2) is machinery for eight rows.
//! So the duplication stays (rung 3). Each impl names its variant, and the
//! payload type fixes which variant it can be, so a mismatch does not
//! compile.
//!
//! `f64` is not a payload: it enters `Unpacked::Number` through `Number`'s
//! canonicalizing conversion, and nothing comes back out as `f64`, so it has a
//! `From` and no `TryFrom`.

use crate::vm::{Array, BigInt, Function, IVm, Number, Object, String, Unpacked, nullish::Nullish};

impl<A: IVm> From<Nullish> for Unpacked<A> {
    fn from(value: Nullish) -> Self {
        Unpacked::Nullish(value)
    }
}

impl<A: IVm> From<bool> for Unpacked<A> {
    fn from(value: bool) -> Self {
        Unpacked::Boolean(value)
    }
}
impl<A: IVm> From<Number> for Unpacked<A> {
    fn from(value: Number) -> Self {
        Unpacked::Number(value)
    }
}

impl<A: IVm> From<f64> for Unpacked<A> {
    fn from(value: f64) -> Self {
        Unpacked::Number(value.into())
    }
}

impl<A: IVm> From<String<A>> for Unpacked<A> {
    fn from(value: String<A>) -> Self {
        Unpacked::String(value)
    }
}

impl<A: IVm> From<BigInt<A>> for Unpacked<A> {
    fn from(value: BigInt<A>) -> Self {
        Unpacked::BigInt(value)
    }
}

impl<A: IVm> From<Object<A>> for Unpacked<A> {
    fn from(value: Object<A>) -> Self {
        Unpacked::Object(value)
    }
}

impl<A: IVm> From<Array<A>> for Unpacked<A> {
    fn from(value: Array<A>) -> Self {
        Unpacked::Array(value)
    }
}

impl<A: IVm> From<Function<A>> for Unpacked<A> {
    fn from(value: Function<A>) -> Self {
        Unpacked::Function(value)
    }
}
