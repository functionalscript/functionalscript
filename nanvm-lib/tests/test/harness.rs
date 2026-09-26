//! Hand-written support for the generated operator tests.
//!
//! A file of `gen.corpus/` contains one statement per case and nothing
//! else. The functions a literal becomes, and `===`/`!==` as operator
//! results, are `nanvm_lib::vm::unstable`'s, the same ones a compiled module
//! calls; every assertion, and the one value constructor no literal spells,
//! lives here, so the printer in `fjs/nanvm/rust/module.f.mjs` only has to
//! name them. Re-exports at the top are what a generated file's
//! `use crate::harness::*;` pulls in, a glob so that no file lists what it
//! happens to use.

pub use nanvm_lib::vm::{
    Any, Array, IStaticFunction, IVm, Nullish, Object, ToAny, ToArray, ToObject,
    unstable::{bigint_any, f64_any, strict_eq, strict_ne, string_any, string_key},
};

use nanvm_lib::{
    common::sized_index::SizedIndex,
    vm::{Property, Unpacked},
};

/// An `Any` holding a function.
///
/// Which function does not matter: every operator covered by the shared data
/// coerces a function through `ToPrimitive`, which never inspects its body.
/// A function is a VM's own to construct, so the corpus bounds on
/// `IStaticFunction`, the capability `naive` has.
pub fn function_any<A: IStaticFunction>() -> Any<A> {
    A::static_function(|_, _| Ok(Nullish::Undefined.to_any()), 0, [].to_array()).to_any()
}

/// The comparison the shared data's expectations are written in, the same
/// as `structurallySame` on the JavaScript side: `Object.is` at every leaf,
/// arrays by their elements, objects by their properties as a set, and
/// functions by identity.
///
/// `==` on `Any` is JavaScript's `===`, which gets `NaN` and `-0` backwards,
/// so numbers are compared by their bits instead — and since a `Number`
/// holds one `NaN`, equal bits is the whole of `Object.is` on numbers. It is
/// also identity on an array or an object, and a method such as `map`
/// answers a fresh array, which no expectation can be the same object as.
fn same<A: IVm>(a: &Any<A>, b: &Any<A>) -> bool {
    match (a.clone().into(), b.clone().into()) {
        (Unpacked::Number(x), Unpacked::Number(y)) => {
            f64::from(x).to_bits() == f64::from(y).to_bits()
        }
        (Unpacked::Array(x), Unpacked::Array(y)) => {
            x.length() == y.length() && (0..x.length()).all(|i| same(&x[i], &y[i]))
        }
        (Unpacked::Object(x), Unpacked::Object(y)) => {
            x.length() == y.length()
                && (0..x.length()).all(|i| {
                    let (k, v): &Property<A> = &x[i];
                    y.own_property(k).is_some_and(|w| same(v, &w))
                })
        }
        _ => a == b,
    }
}

/// The scope of a case that nests an operation in an eager position: its
/// temporaries bound inside the closure with their `?`, and the root's own
/// `Result` the closure's answer, handed to `check` whole. A name for the
/// call rather than `(|| …)()`, which clippy calls redundant.
pub fn scope<A: IVm>(f: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Result<Any<A>, Any<A>> {
    f()
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
