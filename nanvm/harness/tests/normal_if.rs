//! Ordinary source conditionals reach Rust through the existing source compiler.
//! Their shallow default also participates in the shared Node/interpreter corpus.

use nanvm_harness::{Action, RunError, fixtures::normal_if, run};
use nanvm_lib::{
    naive::Naive,
    vm::{ToAny, ToArray},
};

#[test]
fn normal_branches_join_before_following_work() {
    for (name, condition, expected) in [
        ("normal", true, "20"),
        ("normal", false, "0"),
        ("alternate", true, "20"),
        ("alternate", false, "50"),
    ] {
        assert_eq!(
            run::<Naive>(
                normal_if::module,
                name,
                Action::Call([condition.to_any()].to_array())
            ),
            Ok(expected.into())
        );
    }
}

#[test]
fn branch_locals_keep_shared_and_fresh_invocation_snapshots() {
    for (condition, expected) in [
        (true, "[true,true,true,true,7]"),
        (false, "[true,true,true,true,3]"),
    ] {
        assert_eq!(
            run::<Naive>(
                normal_if::module,
                "snapshotObservation",
                Action::Call([condition.to_any()].to_array())
            ),
            Ok(expected.into())
        );
    }
}

#[test]
fn a_reached_unused_initializer_still_fails() {
    assert_eq!(
        run::<Naive>(
            normal_if::module,
            "selectedFailure",
            Action::Call([false.to_any()].to_array())
        ),
        Ok("0".into())
    );
    assert!(matches!(
        run::<Naive>(
            normal_if::module,
            "selectedFailure",
            Action::Call([true.to_any()].to_array())
        ),
        Err(RunError::Thrown(_))
    ));
}

#[test]
fn a_normal_join_before_a_self_tail_call_stays_bounded() {
    assert_eq!(
        run::<Naive>(
            normal_if::module,
            "tail",
            Action::Call([100_001.0.to_any(), 7.0.to_any()].to_array())
        ),
        Ok("100008".into())
    );
}
