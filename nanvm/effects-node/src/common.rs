//! The operations every host has, `sandbox`, `catch`, `now` and `randomInt`
//! (`fjs/effects/common/module.mjs`, `fjs/effects/node/module.mjs`).
//!
//! `sandbox` and `catch` take a thunk, a function of the program's own, which
//! is called with no arguments like a `Pure`: what it answers is its value, and
//! what it throws is the `Err` the VM's `Result` carries. A thunk is pure, so
//! there is nothing to await: the Node runner's `Promise` case has no native
//! twin.
//!
//! `sandbox` and `now` read a clock, and `randomInt` a seed. `wasm32-unknown-unknown`
//! has neither: `std` panics on the clock there, and seeds `RandomState` with a
//! constant, so a host on that target cannot answer them; WASI has both. The
//! host over `std` has no files on that target either, and refuses all three as
//! not implemented, rather than let `std` panic or answer numbers that only look
//! random: see [`CLOCK`] and [`RANDOM`].

use crate::codec::{encode_number, encode_object, encode_ok, encode_result};
use nanvm_lib::vm::{Any, IVm, ToAny, ToArray};
use std::{
    hash::RandomState,
    hash::{BuildHasher, Hasher},
    time::{Instant, SystemTime, UNIX_EPOCH},
};

/// Whether this target has a clock for `sandbox` and `now`.
pub const CLOCK: bool = !cfg!(all(target_family = "wasm", target_os = "unknown"));

/// Whether this target has a source for `randomInt`. `wasm32-unknown-unknown`
/// has none, and `std` seeds [`RandomState`] there with a constant, so the
/// numbers would be the same on every run.
pub const RANDOM: bool = CLOCK;

/// A thunk called with no arguments.
fn call<A: IVm>(thunk: Any<A>) -> Result<Any<A>, Any<A>> {
    thunk.call([].to_array().to_any())
}

/// `catch`: what the thunk did, as the answer's `Result`.
pub fn catch<A: IVm>(thunk: Any<A>) -> Any<A> {
    encode_ok(encode_result(call(thunk)))
}

/// `sandbox`: what the thunk did and how long it took, in milliseconds.
pub fn sandbox<A: IVm>(thunk: Any<A>) -> Any<A> {
    // The clock brackets the call and nothing else: the outcome is encoded
    // after it is read, as `sandbox` in `fjs/effects/common/module.mjs` does.
    let before = Instant::now();
    let outcome = call(thunk);
    let duration = before.elapsed().as_secs_f64() * 1000.0;
    encode_ok(encode_object([
        Some(("result", encode_result(outcome))),
        Some(("duration", encode_number(duration))),
    ]))
}

/// `now`: milliseconds since the Unix epoch, as `Date.now()` answers, a whole
/// number, negative before 1970.
pub fn now<A: IVm>() -> Any<A> {
    encode_ok(encode_number(epoch_millis(SystemTime::now())))
}

/// The whole milliseconds from the epoch to `time`, rounded down as
/// `Date.now()` rounds.
fn epoch_millis(time: SystemTime) -> f64 {
    match time.duration_since(UNIX_EPOCH) {
        Ok(since) => since.as_millis() as f64,
        Err(before) => {
            let before = before.duration();
            let whole = before.as_millis() as f64;
            -(whole + f64::from(u8::from(before.subsec_nanos() % 1_000_000 != 0)))
        }
    }
}

/// `randomInt`: an integer from 0 up to, not including, 2^32, as the Node
/// runner's `crypto.randomInt(2 ** 32)` answers. **Not cryptographically
/// secure**: see `doc/random-int.md`.
pub fn random_int<A: IVm>() -> Any<A> {
    encode_ok(encode_number(f64::from(random_u32())))
}

/// The top 32 bits of the hash `RandomState` gives an empty input. Each
/// `RandomState` has keys the OS seeded once per thread and a counter, so
/// every call hashes under a different key.
fn random_u32() -> u32 {
    (RandomState::new().build_hasher().finish() >> 32) as u32
}

#[cfg(test)]
mod test {
    use super::epoch_millis;
    use std::time::{Duration, UNIX_EPOCH};

    /// The numbers vary from call to call. A fixed answer, which is what a
    /// target without a seed gives, is one value 64 times.
    #[cfg(not(all(target_family = "wasm", target_os = "unknown")))]
    #[test]
    fn random_numbers_vary() {
        let numbers: std::collections::HashSet<u32> =
            (0..64).map(|_| super::random_u32()).collect();
        assert!(numbers.len() > 32, "{} different in 64", numbers.len());
    }

    #[test]
    fn a_time_before_the_epoch_is_negative_and_rounded_down() {
        assert_eq!(epoch_millis(UNIX_EPOCH + Duration::from_micros(1500)), 1.0);
        assert_eq!(epoch_millis(UNIX_EPOCH), 0.0);
        assert_eq!(epoch_millis(UNIX_EPOCH - Duration::from_micros(1500)), -2.0);
        assert_eq!(epoch_millis(UNIX_EPOCH - Duration::from_millis(3)), -3.0);
    }
}
