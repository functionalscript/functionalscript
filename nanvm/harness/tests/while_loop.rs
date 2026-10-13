//! A loop compiled to Rust's `loop` rather than to a call per round:
//! `fixtures/while-loop.mjs`'s `count` over a million rounds, which
//! `Any::call` of `self_` per round could not survive on any stack. The
//! default export, the same loops over a few rounds, is `tests/parity.rs`'s.

use nanvm_harness::{Action, fixtures::while_loop, run};
use nanvm_lib::{
    naive::Naive,
    vm::{ToAny, ToArray},
};

#[test]
fn a_million_rounds() {
    let args = [1_000_000.0.to_any()].to_array();
    assert_eq!(
        run::<Naive>(while_loop::module, "count", Action::Call(args)),
        Ok("1000000".into())
    );
}

#[test]
fn a_state_with_two_values() {
    let args = [1000.0.to_any()].to_array();
    assert_eq!(
        run::<Naive>(while_loop::module, "sums", Action::Call(args)),
        Ok("[1000,500500]".into())
    );
}
