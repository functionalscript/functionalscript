//! Programs that return effects, compiled by `fjs compile`, performed by the
//! native runner of `nanvm-effects-node`: the pipeline from FunctionalScript
//! source to an operation on the operating system's streams, in one test
//! (`todo/nanvm-effects-node.md`, `nanvm-lib/todo/mvp-roadmap.md`).

use std::io::Cursor;

use nanvm_effects_node::{Native, run};
use nanvm_harness::fixtures::effect;
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Array, Object, ToAny, unstable::string_any},
};

type V = Any<Naive>;

/// An export of the compiled module, which is an effect.
fn export(name: &str) -> V {
    Object::try_from(effect::module::<Naive>().unwrap())
        .unwrap()
        .own_property(&name.into())
        .unwrap()
}

fn items(any: V) -> Vec<V> {
    Array::try_from(any).unwrap().into_iter().collect()
}

fn runner() -> Native<Cursor<Vec<u8>>, Vec<u8>, Vec<u8>> {
    Native::new(Cursor::new(vec![]), vec![], vec![])
}

/// Two writes, the second reached through the first's continuation, which
/// ignores the answer; the result is the second's answer, `['ok', undefined]`.
#[test]
fn a_chain_of_commands() {
    let mut r = runner();
    let result = run(&mut r, export("hello")).unwrap().unwrap();
    assert_eq!(r.stdout().as_slice(), b"hibye");
    assert!(r.stderr().is_empty());
    let answer = items(result);
    assert_eq!(answer[0], string_any("ok"));
    assert_eq!(answer[1], nanvm_lib::vm::Nullish::Undefined.to_any());
}

/// A command the runner has no operation for is answered through the
/// continuation as `['error', ['notImplemented', command]]`.
#[test]
fn a_command_the_runner_lacks() {
    let result = run(&mut runner(), export("missing")).unwrap().unwrap();
    let answer = items(result);
    assert_eq!(answer[0], string_any("error"));
    assert_eq!(
        items(answer[1].clone()),
        vec![string_any("notImplemented"), string_any("fetch")]
    );
}

/// A thunk that throws in the language: `catch` hands the program what was
/// thrown, as the value `1n / 0n` throws.
#[test]
fn a_language_throw_is_caught() {
    let result = run(&mut runner(), export("caught")).unwrap().unwrap();
    let answer = items(result);
    assert_eq!(answer[0], string_any("ok"));
    let caught = items(answer[1].clone());
    assert_eq!(caught[0], string_any("error"));
    assert_eq!(caught.len(), 2);
}
