//! The native runner of effects (`todo/nanvm-effects-node.md`): the Rust twin
//! of the loop in `fjs/effects/module.mjs`, over `nanvm-lib`'s own values.
//!
//! An effect is what `fjs/effects` builds, and the program's own VM values stay
//! as they are: a `Pure`, a function that takes nothing and answers a `Result`,
//! or a `Do`, an object with the `command` to perform, its `payload` and the
//! `continuation` that takes the answer to the next effect. There is no native
//! copy of any of it: the loop reads three properties, calls two kinds of
//! function and hands values on, so identity survives. Only a [`Native`] host,
//! the `perform` over `std`, reads a request out of VM values, and writes its
//! answer back.
//!
//! `nanvm-effects-node` depends on `nanvm-lib`, never the reverse.

mod codec;
mod files;
mod native;

pub use files::{Dirent, IoError, MAX_FILE_SIZE_BYTES, normalize};
pub use native::Native;

use nanvm_lib::vm::{Any, IVm, ToAny, ToArray};

/// Performs `effect` to its result.
///
/// A `Pure` is called with no arguments and answers its complete FJS `Result`,
/// `['ok', v]` or `['error', e]`, unchanged. A `Do` is handed to `perform`, as
/// its `command` and `payload`, and the complete answer, an `error` included,
/// goes to its `continuation`, which gives the next effect. `perform` is the
/// synchronous boundary where an operation happens; what it does is not the
/// loop's.
///
/// The outer `Result` is the VM's, which is different: `Err` is a language
/// throw, from `perform` or from any function the loop calls, and ends the run
/// with the value thrown.
///
/// The loop is a loop: one effect after another takes no more stack than one.
pub fn run<A: IVm>(
    mut effect: Any<A>,
    mut perform: impl FnMut(Any<A>, Any<A>) -> Result<Any<A>, Any<A>>,
) -> Result<Any<A>, Any<A>> {
    loop {
        if effect.clone().typeof_()? == "function".into() {
            return effect.call([].to_array().to_any());
        }
        let command = effect.clone().dot("command".into()).end()?;
        let payload = effect.clone().dot("payload".into()).end()?;
        let continuation = effect.dot("continuation".into()).end()?;
        let answer = perform(command, payload)?;
        effect = continuation.call([answer].to_array().to_any())?;
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use nanvm_lib::{
        naive::Naive,
        vm::{
            Array, Function, IStaticFunction, Nullish, Number, StaticCode, ToObject,
            unstable::{f64_any, string_any, string_key},
        },
    };

    type V = Any<Naive>;

    /// A function value that runs `code` with the `frame` it is given.
    fn function(code: StaticCode<Naive>, frame: Vec<V>) -> V {
        Naive::static_function(code, 0, frame.to_array(), None).to_any()
    }

    fn items(any: V) -> Vec<V> {
        Array::try_from(any).unwrap().into_iter().collect()
    }

    /// `['ok', v]` or `['error', e]`, as the language builds a `Result`.
    fn result(tag: &str, v: V) -> V {
        vec![string_any(tag), v].to_array().to_any()
    }

    /// A `Pure` answering `r`, the very value, from its frame.
    fn pure(r: V) -> V {
        function(|self_, _| Ok(Naive::frame(self_)[0].clone()), vec![r])
    }

    /// A `Do` of `command`, `payload` and `continuation`.
    fn node(command: &str, payload: V, continuation: V) -> V {
        vec![
            (string_key::<Naive>("command"), string_any(command)),
            (string_key::<Naive>("payload"), payload),
            (string_key::<Naive>("continuation"), continuation),
        ]
        .to_object()
        .to_any()
    }

    fn empty() -> V {
        Vec::<V>::new().to_array().to_any()
    }

    /// A boundary that answers every command `['ok', undefined]`.
    fn answers_ok(_: V, _: V) -> Result<V, V> {
        Ok(result("ok", Nullish::Undefined.to_any()))
    }

    /// A continuation that ends the run with `['ok', the answer it was given]`.
    fn ends_with_the_answer() -> V {
        function(|_, args| Ok(pure(result("ok", args[0].clone()))), vec![])
    }

    /// A `Pure` ends the run with its complete `Result`, an `error` too, as
    /// the very value it answered.
    #[test]
    fn a_pure_effect_is_its_result() {
        let ok = result("ok", f64_any(0x4014000000000000));
        assert_eq!(run(pure(ok.clone()), answers_ok), Ok(ok));
        let error = result("error", string_any("no"));
        assert_eq!(run(pure(error.clone()), answers_ok), Ok(error));
    }

    /// A `Do` is handed to the boundary, and what the boundary answers goes to
    /// its continuation, which gives the next effect.
    #[test]
    fn commands_run_in_order_through_their_continuations() {
        let last = node("c", empty(), ends_with_the_answer());
        let next = function(|self_, _| Ok(Naive::frame(self_)[0].clone()), vec![last]);
        let middle = node("b", empty(), next);
        let next = function(|self_, _| Ok(Naive::frame(self_)[0].clone()), vec![middle]);
        let first = node("a", empty(), next);
        let mut seen = Vec::new();
        let done = run(first, |command, _| {
            seen.push(command);
            Ok(result("ok", Number::from(seen.len() as f64).to_any()))
        })
        .unwrap();
        assert_eq!(
            seen,
            vec![string_any("a"), string_any("b"), string_any("c")]
        );
        // The last answer is the third one, a `['ok', 3]`, inside the `['ok', _]`.
        let inner = items(items(done)[1].clone());
        assert_eq!(inner[0], string_any("ok"));
        assert_eq!(
            f64::from(Number::try_from(inner[1].clone()).unwrap()),
            f64::from_bits(0x1) * 0.0 + 3.0_f64.min(3.0)
        );
    }

    /// An operation that fails answers an `error`, which is an answer: the
    /// continuation receives the complete value, the very one, and goes on.
    #[test]
    fn an_operation_error_reaches_the_continuation_whole() {
        let error = result("error", string_any("ENOENT"));
        let effect = node("readFile", empty(), ends_with_the_answer());
        let answer = error.clone();
        let done = run(effect, move |_, _| Ok(answer.clone())).unwrap();
        let parts = items(done);
        assert_eq!(parts[0], string_any("ok"));
        assert_eq!(parts[1], error);
    }

    /// The loop is told neither the command nor the payload by a copy: the
    /// boundary receives the very values the program built, and a function the
    /// program returns is the function it returned.
    #[test]
    fn values_keep_their_identity() {
        let payload = empty();
        let kept = payload.clone();
        let callable = function(|_, _| Ok(f64_any(0)), vec![]);
        let returned = callable.clone();
        let continuation = function(
            |self_, _| Ok(pure(result("ok", Naive::frame(self_)[0].clone()))),
            vec![returned],
        );
        let mut got = None;
        let done = run(node("x", payload, continuation), |_, p| {
            got = Some(p);
            Ok(result("ok", Nullish::Undefined.to_any()))
        })
        .unwrap();
        assert_eq!(got, Some(kept));
        let parts = items(done);
        assert_eq!(parts[1], callable);
        assert!(Function::try_from(parts[1].clone()).is_ok());
    }

    /// A language throw is the outer `Err`: from a `Pure`, from a continuation,
    /// from the boundary, and from a continuation that is no function.
    #[test]
    fn language_throws_propagate() {
        let thrower = |_: &_, _| Err::<V, V>(string_any("boom"));
        assert_eq!(
            run(function(thrower, vec![]), answers_ok),
            Err(string_any("boom"))
        );
        let in_continuation = node("x", empty(), function(thrower, vec![]));
        assert_eq!(run(in_continuation, answers_ok), Err(string_any("boom")));
        let from_boundary = node("x", empty(), ends_with_the_answer());
        assert_eq!(
            run(from_boundary, |_, _| Err(string_any("refused"))),
            Err(string_any("refused"))
        );
        let no_continuation = node("x", empty(), f64_any(0));
        assert!(run(no_continuation, answers_ok).is_err());
    }

    /// One effect after another takes no more stack than one: a hundred thousand
    /// commands, each reached through its predecessor's continuation, on a
    /// thread whose stack would not hold a recursion of that depth.
    #[test]
    fn a_long_sequence_does_not_grow_the_stack() {
        const TICKS: u64 = 100_000;
        /// The continuation after a command with `n` more to go, `n` being the
        /// frame's one number: the next command, or the end.
        fn countdown(
            self_: &<Naive as nanvm_lib::vm::IVm>::InternalFunction,
            _: Array<Naive>,
        ) -> Result<V, V> {
            let n = f64::from(Number::try_from(Naive::frame(self_)[0].clone()).unwrap());
            if n == 0.0 {
                return Ok(pure(result("ok", Nullish::Null.to_any())));
            }
            let next = function(countdown, vec![Number::from(n - 1.0).to_any()]);
            Ok(node("tick", empty(), next))
        }
        // What leaves the thread is plain data: the VM's values are not `Send`.
        let work = || {
            let mut ticks = 0u64;
            let done = run(
                node(
                    "tick",
                    empty(),
                    function(countdown, vec![Number::from((TICKS - 1) as f64).to_any()]),
                ),
                |_, _| {
                    ticks += 1;
                    Ok(result("ok", Nullish::Undefined.to_any()))
                },
            );
            let ended = done.is_ok_and(|r| items(r)[0] == string_any("ok"));
            (ended, ticks)
        };
        #[cfg(not(target_family = "wasm"))]
        let (ended, ticks) = std::thread::Builder::new()
            .stack_size(256 * 1024)
            .spawn(work)
            .unwrap()
            .join()
            .unwrap();
        #[cfg(target_family = "wasm")]
        let (ended, ticks) = work();
        assert!(ended);
        assert_eq!(ticks, TICKS);
    }
}
