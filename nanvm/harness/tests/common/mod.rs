//! What the fixture tests share: a fixture module exports its cases by name,
//! and each case is an object whose `run` makes the program for a host to
//! perform and whose `expected` is what that program answers.

use nanvm_effects_node::{Native, run};
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Array, Function, Object, unstable::string_any},
};
use std::io::{Read, Write};

pub type V = Any<Naive>;

pub fn member(object: &Object<Naive>, name: &str) -> V {
    object.own_property(&name.into()).unwrap()
}

/// The names of the module's exports, which are the cases.
pub fn names(exports: &Object<Naive>) -> Vec<String> {
    exports
        .own_entries()
        .into_iter()
        .map(|(key, _)| key.into())
        .collect()
}

/// Calls `case`'s `run` with `arguments` and performs the program on `host`:
/// it must finish `ok` and answer what `case` expects.
pub fn perform_case<R: Read, O: Write, E: Write>(
    name: &str,
    case: &Object<Naive>,
    arguments: Array<Naive>,
    host: &mut Native<R, O, E>,
) {
    let effect = Function::try_from(member(case, "run"))
        .unwrap()
        .call(arguments)
        .unwrap();
    let result = run(effect, |command, payload| host.perform(command, payload))
        .unwrap_or_else(|thrown| panic!("{name} threw {thrown:?}"));
    let [tag, answers]: [V; 2] = Array::try_from(result).unwrap().try_into().unwrap();
    assert_eq!(tag, string_any("ok"), "{name}");
    assert_eq!(
        answers.to_json().unwrap(),
        member(case, "expected").to_json().unwrap(),
        "{name}"
    );
}
