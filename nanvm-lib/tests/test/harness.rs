//! Hand-written support for the generated operator tests.
//!
//! `generated.rs` contains one statement per case and nothing else. The
//! functions a literal becomes, and `===`/`!==` as operator results, are
//! `nanvm_lib::vm::unstable`'s, the same ones a compiled module calls; every
//! assertion, and the one value constructor no literal spells, lives here, so
//! the printer in `fjs/nanvm/rust/module.f.mjs` only has to name them.
//! Re-exports at the top are what the generated file's `use super::harness::*;`
//! pulls in.

pub use nanvm_lib::vm::{
    Any, Array, IStaticFunction, IVm, Nullish, Object, ToAny, ToArray, ToObject,
};

use nanvm_lib::vm::Unpacked;

/// An `Any` holding a function.
///
/// Which function does not matter: every operator covered by the shared data
/// coerces a function through `ToPrimitive`, which never inspects its body.
/// A function is a VM's own to construct, so the corpus bounds on
/// `IStaticFunction`, the capability `naive` has.
pub fn function_any<A: IStaticFunction>() -> Any<A> {
    A::static_function(|_, _| Ok(Nullish::Undefined.to_any()), 0, [].to_array()).to_any()
}

/// `Object.is`, the comparison the shared data's expectations are written in:
/// `NaN` matches `NaN`, and `0` does not match `-0`.
///
/// `==` on `Any` is JavaScript's `===`, which gets both of those backwards, so
/// numbers are compared by their bits instead — and since a `Number` holds
/// one `NaN`, equal bits is the whole of `Object.is` on numbers.
fn same<A: IVm>(a: &Any<A>, b: &Any<A>) -> bool {
    match (a.clone().into(), b.clone().into()) {
        (Unpacked::Number(x), Unpacked::Number(y)) => {
            f64::from(x).to_bits() == f64::from(y).to_bits()
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
