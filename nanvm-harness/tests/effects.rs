//! Programs that return effects, compiled by `fjs compile`, run through the
//! loop of `nanvm-effects-node`: the pipeline from FunctionalScript source to
//! a performed command, in one test.

use nanvm_effects_node::{Native, run};
use nanvm_harness::fixtures::effect;
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Array, Nullish, Object, ToAny, unstable::string_any},
};

/// An export of the compiled module, which is an effect.
fn export(name: &str) -> Any<Naive> {
    Object::try_from(effect::module::<Naive>().unwrap())
        .unwrap()
        .own_property(&name.into())
        .unwrap()
}

/// Two commands; `echo` answers its payload, so the result shows both ran in
/// order and that each answer reached its continuation.
#[test]
fn a_chain_of_commands() {
    let mut commands = Vec::new();
    let result = run(export("chain"), |command, payload| {
        commands.push(command.to_json().unwrap());
        Ok(payload)
    });
    assert_eq!(
        result.unwrap().to_json(),
        Ok("[\"ok\",[[\"first\"],\"second\"]]".into())
    );
    assert_eq!(commands, ["\"echo\"", "\"echo\""]);
}

/// A continuation that throws ends the run with what it threw.
#[test]
fn a_language_throw_ends_the_run() {
    assert!(run(export("thrown"), |_, payload| Ok(payload)).is_err());
}

fn items(any: Any<Naive>) -> Vec<Any<Naive>> {
    Array::try_from(any).unwrap().into_iter().collect()
}

fn host() -> Native<std::io::Cursor<Vec<u8>>, Vec<u8>, Vec<u8>> {
    Native::new(std::io::Cursor::new(Vec::new()), Vec::new(), Vec::new())
}

/// Two writes, the second reached through the first's continuation; the
/// result holds the second's answer, `['ok', undefined]`.
#[test]
fn a_program_writes_to_the_console() {
    let mut host = host();
    let result = run(export("hello"), |command, payload| {
        host.perform(command, payload)
    })
    .unwrap();
    assert_eq!(host.stdout().as_slice(), b"hibye");
    assert!(host.stderr().is_empty());
    let [tag, answer] = items(result).try_into().unwrap();
    assert_eq!(tag, string_any("ok"));
    assert_eq!(
        items(answer),
        [string_any("ok"), Nullish::Undefined.to_any()]
    );
}

/// A command the host lacks is answered through the continuation as
/// `['error', ['notImplemented', command]]`, and the program carries on.
#[test]
fn a_command_the_host_lacks() {
    let mut host = host();
    let result = run(export("missing"), |command, payload| {
        host.perform(command, payload)
    })
    .unwrap();
    let answer = items(result);
    assert_eq!(answer[0], string_any("ok"));
    assert_eq!(
        answer[1].clone().to_json(),
        Ok("[\"error\",[\"notImplemented\",\"fetch\"]]".into())
    );
}
