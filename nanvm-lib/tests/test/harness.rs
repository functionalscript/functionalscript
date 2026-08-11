//! Hand-written support for the generated operator tests.
//!
//! `generated.rs` contains one statement per case and nothing else; every
//! value constructor and every assertion it uses lives here, so the printer in
//! `../rust/module.f.mjs` only has to name them. Re-exports at the top are
//! what the generated file's `use super::harness::*;` pulls in.

pub use nanvm_lib::vm::{Any, Array, IVm, Nullish, Object, ToAny, ToArray, ToObject};

use nanvm_lib::vm::{BigInt, Function, IContainer, String, Unpacked};

/// An `Any` holding the string `v`.
pub fn string_any<A: IVm>(v: &str) -> Any<A> {
    v.into()
}

/// An object property key.
pub fn string_key<A: IVm>(v: &str) -> String<A> {
    v.into()
}

/// An `Any` holding the bigint `v`.
pub fn bigint_any<A: IVm>(v: i64) -> Any<A> {
    Into::<BigInt<A>>::into(v).to_any()
}

/// An `Any` holding a function.
///
/// Which function does not matter: every operator covered by the shared data
/// coerces a function through `ToPrimitive`, which never inspects its body.
pub fn function_any<A: IVm>() -> Any<A> {
    Function::<A>(A::InternalFunction::new_ok(("".into(), 0), [0])).to_any()
}

/// `Object.is`, the comparison the shared data's expectations are written in:
/// `NaN` matches `NaN`, and `0` does not match `-0`.
///
/// `==` on `Any` is JavaScript's `===`, which gets both of those backwards, so
/// numbers are compared by their bits instead.
fn same<A: IVm>(a: &Any<A>, b: &Any<A>) -> bool {
    match (a.clone().into(), b.clone().into()) {
        (Unpacked::Number(x), Unpacked::Number(y)) => {
            if x.is_nan() || y.is_nan() {
                x.is_nan() && y.is_nan()
            } else {
                x.to_bits() == y.to_bits()
            }
        }
        _ => a == b,
    }
}

/// Checks that an operator returned `expected`.
pub fn check<A: IVm>(case: &str, result: Result<Any<A>, Any<A>>, expected: Any<A>) {
    match result {
        Ok(v) => assert!(same(&v, &expected), "{case}: {v:?} is not {expected:?}"),
        Err(e) => panic!("{case}: unexpected throw: {e:?}"),
    }
}

/// Checks that an operator threw.
///
/// The thrown value is engine-specific, so the shared data does not describe
/// it and nothing here asserts on it.
pub fn check_throws<A: IVm>(case: &str, result: Result<Any<A>, Any<A>>) {
    if let Ok(v) = result {
        panic!("{case}: expected a throw, got {v:?}");
    }
}

/// Checks strict equality (`===`) both ways round.
pub fn check_eq<A: IVm>(case: &str, a: Any<A>, b: Any<A>, expected: bool) {
    assert_eq!(a == b, expected, "{case}");
    assert_eq!(b == a, expected, "{case} reversed");
}
