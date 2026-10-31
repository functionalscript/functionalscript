//! Programs that return effects, compiled by `fjs compile`, run through the
//! loop of `nanvm-effects-node`: the pipeline from FunctionalScript source to
//! a performed command, in one test.

use nanvm_effects_node::{Native, run};
use nanvm_harness::{fixtures::effect, runtime};
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Array, Nullish, Object, ToAny, unstable::string_any},
};

/// An export of the compiled module, which is an effect.
fn export(name: &str) -> Any<Naive> {
    Object::try_from(effect::module::<Naive>(runtime()).unwrap())
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

/// Two writes, the second reached through the first's continuation; the
/// result holds the second's answer, `['ok', undefined]`.
#[test]
fn a_program_writes_to_the_console() {
    let mut host = Native::buffered(&[]);
    let result = run(export("hello"), |command, payload| {
        host.perform(command, payload)
    })
    .unwrap();
    assert_eq!(host.stdout().as_slice(), b"hibye");
    assert!(host.stderr().is_empty());
    let [tag, answer]: [Any<Naive>; 2] = Array::try_from(result).unwrap().try_into().unwrap();
    assert_eq!(tag, string_any("ok"));
    let answer: [Any<Naive>; 2] = Array::try_from(answer).unwrap().try_into().unwrap();
    assert_eq!(answer, [string_any("ok"), Nullish::Undefined.to_any()]);
}

/// A command the host lacks is answered through the continuation as
/// `['error', ['notImplemented', command]]`, and the program carries on.
#[test]
fn a_command_the_host_lacks() {
    let mut host = Native::buffered(&[]);
    let result = run(export("missing"), |command, payload| {
        host.perform(command, payload)
    })
    .unwrap();
    let [tag, answer]: [Any<Naive>; 2] = Array::try_from(result).unwrap().try_into().unwrap();
    assert_eq!(tag, string_any("ok"));
    assert_eq!(
        answer.to_json(),
        Ok("[\"error\",[\"notImplemented\",\"fetch\"]]".into())
    );
}
