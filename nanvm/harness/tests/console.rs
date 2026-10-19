//! The native host against the Node one, for the console. `fixtures/console.mjs`
//! holds programs that read standard input and write standard output and error;
//! they are performed here by `nanvm-effects-node` over buffers, and by the Node
//! runner in `fjs/nanvm/parity/console.proof.mjs` over a child process's streams.
//! Both must answer what a case says, and write the bytes it says.

use nanvm_effects_node::{Native, run};
use nanvm_harness::{fixtures::console, runtime};
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Array, Function, Number, Object, ToArray, unstable::string_any},
};
use std::io::Cursor;

type V = Any<Naive>;

fn member(object: &Object<Naive>, name: &str) -> V {
    object.own_property(&name.into()).unwrap()
}

/// The names of the module's exports, which are the cases.
fn names(exports: &Object<Naive>) -> Vec<String> {
    exports
        .own_entries()
        .into_iter()
        .map(|(key, _)| key.into())
        .collect()
}

/// An array of byte values.
fn bytes(any: V) -> Vec<u8> {
    Array::try_from(any)
        .unwrap()
        .into_iter()
        .map(|n| f64::from(Number::try_from(n).unwrap()) as u8)
        .collect()
}

/// `[1,2]`, as JSON spells a list of bytes.
fn json(bytes: &[u8]) -> String {
    let items: Vec<String> = bytes.iter().map(u8::to_string).collect();
    format!("[{}]", items.join(","))
}

#[test]
fn the_native_host_answers_what_the_cases_expect() {
    let exports = Object::try_from(console::module::<Naive>(runtime()).unwrap()).unwrap();
    let cases = names(&exports);
    assert!(!cases.is_empty());
    for case in cases {
        let object = Object::try_from(member(&exports, &case)).unwrap();
        let effect = Function::try_from(member(&object, "run"))
            .unwrap()
            .call([].to_array())
            .unwrap();
        let mut host = Native::new(
            Cursor::new(bytes(member(&object, "input"))),
            Vec::new(),
            Vec::new(),
        );
        let result = run(effect, |command, payload| host.perform(command, payload))
            .unwrap_or_else(|thrown| panic!("{case} threw {thrown:?}"));
        let [tag, answers]: [V; 2] = Array::try_from(result).unwrap().try_into().unwrap();
        assert_eq!(tag, string_any("ok"), "{case}");
        assert_eq!(
            answers.to_json().unwrap(),
            member(&object, "expected").to_json().unwrap(),
            "{case}"
        );
        assert_eq!(
            json(host.stdout()),
            member(&object, "stdout").to_json().unwrap(),
            "{case} stdout"
        );
        assert_eq!(
            json(host.stderr()),
            member(&object, "stderr").to_json().unwrap(),
            "{case} stderr"
        );
    }
}
