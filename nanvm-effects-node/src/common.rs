//! The operations every host has, `sandbox`, `catch` and `now`
//! (`fjs/effects/common/module.mjs`, `fjs/effects/node/module.mjs`).
//!
//! `sandbox` and `catch` take a thunk, a function of the program's own, which
//! is called with no arguments like a `Pure`: what it answers is its value, and
//! what it throws is the `Err` the VM's `Result` carries. A thunk is pure, so
//! there is nothing to await: the Node runner's `Promise` case has no native
//! twin.

use crate::codec::{encode_number, encode_object, encode_ok, encode_tuple};
use nanvm_lib::vm::{Any, IVm, ToAny, ToArray};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

/// A thunk called, as the language's `Result`: `['ok', value]`, or
/// `['error', what it threw]`.
fn call<A: IVm>(thunk: Any<A>) -> Any<A> {
    match thunk.call([].to_array().to_any()) {
        Ok(value) => encode_tuple("ok", value),
        Err(thrown) => encode_tuple("error", thrown),
    }
}

/// `catch`: what the thunk did, as the answer's `Result`.
pub fn catch<A: IVm>(thunk: Any<A>) -> Any<A> {
    encode_ok(call(thunk))
}

/// `sandbox`: what the thunk did and how long it took, in milliseconds.
pub fn sandbox<A: IVm>(thunk: Any<A>) -> Any<A> {
    let before = Instant::now();
    let result = call(thunk);
    let duration = before.elapsed().as_secs_f64() * 1000.0;
    encode_ok(encode_object([
        Some(("result", result)),
        Some(("duration", encode_number(duration))),
    ]))
}

/// `now`: milliseconds since the Unix epoch, as `Date.now()` answers, a whole
/// number.
pub fn now<A: IVm>() -> Any<A> {
    let since = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("the system clock is before 1970");
    encode_ok(encode_number(since.as_millis() as f64))
}
