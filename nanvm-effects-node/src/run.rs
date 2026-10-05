//! Running an `Effect` to its result: the Rust twin of the loop in
//! `fjs/effects/module.mjs`, with the two operations that are every host's,
//! `sandbox` and `catch`, which the generated [`dispatch`] does not have
//! because they take a function.
//!
//! An effect is a value the program built (`fjs/effects/README.md`): a `Pure`,
//! a function answering a `Result`, or a `Do`, an object with the `command` to
//! perform, its `payload` and the `continuation` that takes the answer to the
//! next effect. A runner performs the command, hands the answer to the
//! continuation, and goes on until it meets a `Pure`.

use crate::{
    Malformed, Operations, argument, arity, decode_array, decode_string, dispatch, encode_string,
    encode_tuple, required,
};
use nanvm_lib::{
    common::sized_index::SizedIndex,
    vm::{Any, Array, IVm, Object, ToAny, ToArray, ToObject, Unpacked, unstable::string_key},
};
use std::time::Instant;

/// Why a run did not reach a result.
pub enum Failure<A: IVm> {
    /// A value that is not what an effect, a request or an answer must be.
    Malformed(Malformed),
    /// The program threw: a `Pure`, a continuation or a thunk it gave, in the
    /// language, as an exception ends a JavaScript runner's loop.
    Thrown(Any<A>),
}

// Written out: a derive would ask `A` itself to be `Debug`, `Clone` and
// `PartialEq`, which a VM is not.

impl<A: IVm> Clone for Failure<A> {
    fn clone(&self) -> Self {
        match self {
            Failure::Malformed(m) => Failure::Malformed(m.clone()),
            Failure::Thrown(a) => Failure::Thrown(a.clone()),
        }
    }
}

impl<A: IVm> PartialEq for Failure<A> {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Failure::Malformed(a), Failure::Malformed(b)) => a == b,
            (Failure::Thrown(a), Failure::Thrown(b)) => a == b,
            _ => false,
        }
    }
}

impl<A: IVm> std::fmt::Debug for Failure<A> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Failure::Malformed(m) => f.debug_tuple("Malformed").field(m).finish(),
            Failure::Thrown(a) => f.debug_tuple("Thrown").field(a).finish(),
        }
    }
}

fn nothing<A: IVm>() -> Any<A> {
    Vec::<Any<A>>::new().to_array().to_any()
}

fn malformed<T, A: IVm>(what: &str) -> Result<T, Failure<A>> {
    Err(Failure::Malformed(Malformed(what.to_string())))
}

/// `['ok', value]` or `['error', failure]`, as the language's `Result`.
fn result<A: IVm>(r: Result<Any<A>, Any<A>>) -> Any<A> {
    match r {
        Ok(v) => encode_tuple("ok", vec![v]),
        Err(e) => encode_tuple("error", vec![e]),
    }
}

/// A `Result` read as one.
fn read_result<A: IVm>(any: Any<A>) -> Result<Result<Any<A>, Any<A>>, Failure<A>> {
    let Ok(items) = Array::try_from(any) else {
        return malformed("an answer that is not a `Result`");
    };
    if items.length() != 2 {
        return malformed("an answer that is not a `Result`");
    }
    match decode_string(items[0].clone()) {
        Ok(tag) if tag == "ok" => Ok(Ok(items[1].clone())),
        Ok(tag) if tag == "error" => Ok(Err(items[1].clone())),
        _ => malformed("an answer that is not a `Result`"),
    }
}

/// What a runner answers a command it has no operation for: `['error',
/// ['notImplemented', command]]`, through the ordinary continuation, so the
/// program decides what that means.
fn not_implemented<A: IVm>(command: &str) -> Any<A> {
    encode_tuple(
        "error",
        vec![encode_tuple(
            "notImplemented",
            vec![encode_string(command.to_string())],
        )],
    )
}

/// `sandbox`: runs the thunk, answering its result, its value or what it
/// threw, and how long it took in milliseconds.
fn sandbox<A: IVm>(payload: &[Any<A>]) -> Result<Any<A>, Failure<A>> {
    arity(payload, 1).map_err(Failure::Malformed)?;
    let thunk = argument(payload, 0, "f").map_err(Failure::Malformed)?;
    let before = Instant::now();
    let answer = thunk.call(nothing());
    let duration = before.elapsed().as_secs_f64() * 1000.0;
    let members = vec![
        (string_key::<A>("result"), result(answer)),
        (string_key::<A>("duration"), crate::encode_number(duration)),
    ];
    Ok(encode_tuple("ok", vec![members.to_object().to_any()]))
}

/// `catch`: runs the thunk, answering its result.
fn catch<A: IVm>(payload: &[Any<A>]) -> Result<Any<A>, Failure<A>> {
    arity(payload, 1).map_err(Failure::Malformed)?;
    let thunk = argument(payload, 0, "f").map_err(Failure::Malformed)?;
    Ok(encode_tuple("ok", vec![result(thunk.call(nothing()))]))
}

/// What a command answers: the two that are every host's, then the operations
/// the runner implements, then `NotImplemented`.
fn answer<A: IVm, R: Operations>(
    runner: &mut R,
    command: &str,
    payload: &[Any<A>],
) -> Result<Any<A>, Failure<A>> {
    match command {
        "sandbox" => sandbox(payload),
        "catch" => catch(payload),
        _ => match dispatch(runner, command, payload) {
            Some(answer) => answer.map_err(Failure::Malformed),
            None => Ok(not_implemented(command)),
        },
    }
}

/// Performs `effect` to its result: the value it ended with, or the failure it
/// ended with, both the program's. A command the runner has no operation for
/// is answered `NotImplemented`, as `asyncPartialRun` answers it.
pub fn run<A: IVm, R: Operations>(
    runner: &mut R,
    effect: Any<A>,
) -> Result<Result<Any<A>, Any<A>>, Failure<A>> {
    let mut effect = effect;
    loop {
        match Unpacked::from(effect.clone()) {
            Unpacked::Function(_) => {
                let answer = effect.call(nothing()).map_err(Failure::Thrown)?;
                return read_result(answer);
            }
            Unpacked::Object(node) => {
                let Step {
                    command,
                    payload,
                    continuation,
                } = step(&node)?;
                let answer = answer(runner, &command, &payload)?;
                effect = continuation
                    .call(vec![answer].to_array().to_any())
                    .map_err(Failure::Thrown)?;
            }
            _ => return malformed("not an effect"),
        }
    }
}

/// A `Do` node, read.
struct Step<A: IVm> {
    command: String,
    payload: Vec<Any<A>>,
    continuation: Any<A>,
}

/// A `Do`'s command, payload and continuation.
fn step<A: IVm>(node: &Object<A>) -> Result<Step<A>, Failure<A>> {
    let command = required(node, "command").and_then(decode_string);
    let payload = required(node, "payload").and_then(|p| decode_array(p, Ok));
    let continuation = required(node, "continuation");
    match (command, payload, continuation) {
        (Ok(command), Ok(payload), Ok(continuation)) => Ok(Step {
            command,
            payload,
            continuation,
        }),
        (Err(e), _, _) | (_, Err(e), _) | (_, _, Err(e)) => Err(Failure::Malformed(e)),
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{Native, Unimplemented, encode_bytes};
    use nanvm_lib::{
        naive::Naive,
        vm::{
            Function, IStaticFunction, Nullish,
            unstable::{f64_any, string_any},
        },
    };
    use std::io::Cursor;

    type V = Any<Naive>;

    fn function(code: nanvm_lib::vm::StaticCode<Naive>) -> V {
        Naive::static_function(code, 0, [].to_array(), None).to_any()
    }

    /// A `Pure` answering `['ok', 5]`.
    fn pure_ok() -> V {
        function(|_, _| Ok(encode_tuple("ok", vec![f64_any(0x4014000000000000)])))
    }

    /// The continuation that ends the run with the answer it was handed: it
    /// takes the answer and gives a `Pure` that answers `['ok', answer]`.
    fn finish() -> V {
        function(|_, args| {
            Ok(Naive::static_function(
                |self_, _| Ok(encode_tuple("ok", vec![Naive::frame(self_)[0].clone()])),
                0,
                vec![args[0].clone()].to_array(),
                None,
            )
            .to_any())
        })
    }

    fn node(command: &str, payload: Vec<V>, continuation: V) -> V {
        vec![
            (string_key::<Naive>("command"), string_any(command)),
            (string_key::<Naive>("payload"), payload.to_array().to_any()),
            (string_key::<Naive>("continuation"), continuation),
        ]
        .to_object()
        .to_any()
    }

    fn parts(any: V) -> Vec<V> {
        Array::try_from(any).unwrap().into_iter().collect()
    }

    /// The value a run that ends in `finish` has, the answer its command got.
    fn answered(r: Result<Result<V, V>, Failure<Naive>>) -> V {
        r.unwrap().unwrap()
    }

    #[test]
    fn a_pure_effect_is_its_result() {
        let mut r = Unimplemented;
        assert_eq!(run(&mut r, pure_ok()), Ok(Ok(f64_any(0x4014000000000000))));
        let failing = function(|_, _| Ok(encode_tuple("error", vec![string_any("no")])));
        assert_eq!(run(&mut r, failing), Ok(Err(string_any("no"))));
    }

    #[test]
    fn a_command_is_answered_through_its_continuation() {
        let mut r = Native::new(Cursor::new(vec![]), Vec::new(), Vec::new());
        let effect = node(
            "write",
            vec![string_any("stdout"), encode_bytes(b"hi".to_vec())],
            finish(),
        );
        let answer = parts(answered(run(&mut r, effect)));
        assert_eq!(answer[0], string_any("ok"));
        assert_eq!(answer[1], Nullish::Undefined.to_any());
        assert_eq!(r.stdout().as_slice(), b"hi");
    }

    #[test]
    fn a_command_the_runner_lacks_is_not_implemented() {
        let answer = parts(answered(run(
            &mut Unimplemented,
            node("fetch", vec![], finish()),
        )));
        assert_eq!(answer[0], string_any("error"));
        assert_eq!(
            parts(answer[1].clone()),
            vec![string_any("notImplemented"), string_any("fetch")]
        );
        let answer = parts(answered(run(
            &mut Unimplemented,
            node("readFile", vec![string_any("a")], finish()),
        )));
        assert_eq!(
            parts(answer[1].clone()),
            vec![string_any("notImplemented"), string_any("readFile")]
        );
    }

    #[test]
    fn catch_answers_what_the_thunk_did() {
        let value = function(|_, _| Ok(string_any("v")));
        let thrower = function(|_, _| Err(string_any("e")));
        let answer = parts(answered(run(
            &mut Unimplemented,
            node("catch", vec![value], finish()),
        )));
        assert_eq!(answer[0], string_any("ok"));
        assert_eq!(
            parts(answer[1].clone()),
            vec![string_any("ok"), string_any("v")]
        );
        let answer = parts(answered(run(
            &mut Unimplemented,
            node("catch", vec![thrower], finish()),
        )));
        assert_eq!(answer[0], string_any("ok"));
        assert_eq!(
            parts(answer[1].clone()),
            vec![string_any("error"), string_any("e")]
        );
    }

    #[test]
    fn sandbox_answers_the_result_and_the_duration() {
        let value = function(|_, _| Ok(string_any("v")));
        let thrower = function(|_, _| Err(string_any("e")));
        for (thunk, tag, v) in [(value, "ok", "v"), (thrower, "error", "e")] {
            let answer = parts(answered(run(
                &mut Unimplemented,
                node("sandbox", vec![thunk], finish()),
            )));
            assert_eq!(answer[0], string_any("ok"));
            let sandboxed = Object::try_from(answer[1].clone()).unwrap();
            let result = sandboxed.own_property(&string_key("result")).unwrap();
            assert_eq!(parts(result), vec![string_any(tag), string_any(v)]);
            let duration = f64::from(
                nanvm_lib::vm::Number::try_from(
                    sandboxed.own_property(&string_key("duration")).unwrap(),
                )
                .unwrap(),
            );
            assert!(duration >= 0.0 && duration.is_finite());
            assert_eq!(sandboxed.own_entries().len(), 2);
        }
    }

    /// A function the thunk answers is neither serialized nor copied: it
    /// comes back as the very value, which `==` on a function tells.
    #[test]
    fn a_callable_comes_back_as_the_same_value() {
        let inner = function(|_, _| Ok(f64_any(0)));
        let thunk: V = Naive::static_function(
            |self_, _| Ok(Naive::frame(self_)[0].clone()),
            0,
            vec![inner.clone()].to_array(),
            None,
        )
        .to_any();
        let answer = parts(answered(run(
            &mut Unimplemented,
            node("catch", vec![thunk.clone()], finish()),
        )));
        let caught = parts(answer[1].clone());
        assert_eq!(caught[0], string_any("ok"));
        assert_eq!(caught[1], inner);
        assert!(Function::try_from(caught[1].clone()).is_ok());
        let answer = parts(answered(run(
            &mut Unimplemented,
            node("sandbox", vec![thunk], finish()),
        )));
        let sandboxed = Object::try_from(answer[1].clone()).unwrap();
        let result = parts(sandboxed.own_property(&string_key("result")).unwrap());
        assert_eq!(result[1], inner);
    }

    #[test]
    fn what_is_not_an_effect_is_malformed() {
        let malformed = |r: Result<Result<V, V>, Failure<Naive>>| match r {
            Err(Failure::Malformed(m)) => m.0,
            other => panic!("{other:?}"),
        };
        assert_eq!(
            malformed(run(&mut Unimplemented, f64_any(0))),
            "not an effect"
        );
        let bad = |members: Vec<(&str, V)>| {
            members
                .into_iter()
                .map(|(k, v)| (string_key::<Naive>(k), v))
                .collect::<Vec<_>>()
                .to_object()
                .to_any()
        };
        assert_eq!(
            malformed(run(&mut Unimplemented, bad(vec![]))),
            "missing member `command`"
        );
        assert_eq!(
            malformed(run(
                &mut Unimplemented,
                bad(vec![("command", string_any("a"))])
            )),
            "missing member `payload`"
        );
        let payload: V = Vec::<V>::new().to_array().to_any();
        assert_eq!(
            malformed(run(
                &mut Unimplemented,
                bad(vec![
                    ("command", string_any("a")),
                    ("payload", payload.clone())
                ])
            )),
            "missing member `continuation`"
        );
        assert_eq!(
            malformed(run(&mut Unimplemented, node("readFile", vec![], finish()))),
            "missing argument 0, `path`"
        );
        assert_eq!(
            malformed(run(&mut Unimplemented, node("catch", vec![], finish()))),
            "missing argument 0, `f`"
        );
        assert_eq!(
            malformed(run(&mut Unimplemented, node("sandbox", vec![], finish()))),
            "missing argument 0, `f`"
        );
        let thunk = || function(|_, _| Ok(string_any("v")));
        for command in ["sandbox", "catch"] {
            assert_eq!(
                malformed(run(
                    &mut Unimplemented,
                    node(command, vec![thunk(), thunk()], finish())
                )),
                "2 arguments where at most 1 are taken"
            );
        }
        let not_a_result = function(|_, _| Ok(f64_any(0)));
        assert_eq!(
            malformed(run(&mut Unimplemented, not_a_result)),
            "an answer that is not a `Result`"
        );
        let wrong_tag = function(|_, _| Ok(encode_tuple("maybe", vec![f64_any(0)])));
        assert_eq!(
            malformed(run(&mut Unimplemented, wrong_tag)),
            "an answer that is not a `Result`"
        );
        let wrong_length: V = function(|_, _| Ok(Vec::<V>::new().to_array().to_any()));
        assert_eq!(
            malformed(run(&mut Unimplemented, wrong_length)),
            "an answer that is not a `Result`"
        );
    }

    #[test]
    fn what_the_program_throws_ends_the_run() {
        let pure = function(|_, _| Err(string_any("boom")));
        assert_eq!(
            run(&mut Unimplemented, pure),
            Err(Failure::Thrown(string_any("boom")))
        );
        let continuation = function(|_, _| Err(string_any("later")));
        assert_eq!(
            run(&mut Unimplemented, node("fetch", vec![], continuation)),
            Err(Failure::Thrown(string_any("later")))
        );
    }
}
