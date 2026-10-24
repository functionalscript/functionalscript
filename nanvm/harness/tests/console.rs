//! The native host against the Node one, for the console. `fixtures/console.mjs`
//! holds programs that read standard input and write standard output and error;
//! they are performed here by `nanvm-effects-node` over buffers, and by the Node
//! runner in `fjs/nanvm/parity/console.proof.mjs` over a child process's streams.
//! Both must answer what a case says, and write the bytes it says.

mod common;

use common::{V, member, names, perform_case};
use nanvm_effects_node::Native;
use nanvm_harness::{fixtures::console, runtime};
use nanvm_lib::{
    naive::Naive,
    vm::{Array, Number, Object, ToArray},
};
use std::io::Cursor;

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
        let mut host = Native::new(
            Cursor::new(bytes(member(&object, "input"))),
            Vec::new(),
            Vec::new(),
        );
        perform_case(&case, &object, [].to_array(), &mut host);
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
