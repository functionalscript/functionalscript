//! Programs that return effects, compiled by `fjs compile`, run through the
//! loop of `nanvm-effects-node`: the pipeline from FunctionalScript source to
//! a performed command, in one test (`todo/nanvm-effects-node.md`).

use nanvm_effects_node::run;
use nanvm_harness::fixtures::effect;
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Object},
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
    let mut commands = vec![];
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
