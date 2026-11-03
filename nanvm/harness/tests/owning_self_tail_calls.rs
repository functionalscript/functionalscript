//! Owning self tail calls remain bounded across generated source-loop helpers.
//! The shallow default also participates in the shared fixture corpus.

use nanvm_harness::{Action, fixtures::owning_self_tail_calls, run, runtime};
use nanvm_lib::{
    naive::Naive,
    vm::{Function, Object, ToAny, ToArray},
};

fn exports() -> Object<Naive> {
    owning_self_tail_calls::module::<Naive>(runtime())
        .unwrap()
        .try_into()
        .unwrap()
}

fn function(exports: &Object<Naive>, name: &str) -> Function<Naive> {
    Function::try_from(exports.own_property(&name.into()).unwrap()).unwrap()
}

#[test]
fn source_tail_loops_keep_their_public_arity() {
    let exports = exports();
    for (name, length) in [
        ("terminal", 1),
        ("terminalLocals", 2),
        ("ordinaryLocals", 2),
        ("swapped", 3),
    ] {
        assert_eq!(function(&exports, name).length(), length, "{name}");
    }
}

#[test]
fn terminal_self_tail_call_uses_a_loop() {
    let args = [100_001.0.to_any()].to_array();
    assert_eq!(
        run::<Naive>(
            owning_self_tail_calls::module,
            "terminal",
            Action::Call(args)
        ),
        Ok("0".into())
    );
}

#[test]
fn terminal_loop_locals_restart_for_each_invocation() {
    let args = [100_001.0.to_any(), 0.0.to_any()].to_array();
    assert_eq!(
        run::<Naive>(
            owning_self_tail_calls::module,
            "terminalLocals",
            Action::Call(args)
        ),
        Ok("200004".into())
    );
}

#[test]
fn ordinary_loop_locals_restart_for_each_invocation() {
    let args = [100_001.0.to_any(), 0.0.to_any()].to_array();
    assert_eq!(
        run::<Naive>(
            owning_self_tail_calls::module,
            "ordinaryLocals",
            Action::Call(args)
        ),
        Ok("200003".into())
    );
}

#[test]
fn swapped_arguments_read_one_invocation_snapshot() {
    let args = [100_001.0.to_any(), 1.0.to_any(), 2.0.to_any()].to_array();
    assert_eq!(
        run::<Naive>(
            owning_self_tail_calls::module,
            "swapped",
            Action::Call(args)
        ),
        Ok("[2,1]".into())
    );
}
