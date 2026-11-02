//! Partly returning source branches reach Rust through the existing source route.

use nanvm_harness::{Action, RunError, fixtures::mixed_if, run};
use nanvm_lib::{
    naive::Naive,
    vm::{ToAny, ToArray},
};

#[test]
fn an_owning_return_bypasses_the_normal_continuation() {
    for (name, condition, stop, expected) in [
        ("partial", false, false, "9"),
        ("partial", true, false, "9"),
        ("partial", true, true, "7"),
        ("parameterized", false, false, "5"),
        ("parameterized", true, false, "8"),
        ("parameterized", true, true, "7"),
        ("nested", false, false, "[5,5]"),
        ("nested", true, false, "[[7],[7]]"),
        ("nested", true, true, "[99]"),
    ] {
        assert_eq!(
            run::<Naive>(
                mixed_if::module,
                name,
                Action::Call([condition.to_any(), stop.to_any()].to_array())
            ),
            Ok(expected.into())
        );
    }
}

#[test]
fn joined_normal_results_share_one_fresh_allocation() {
    for (condition, expected) in [
        (false, "[true,true,true,5]"),
        (true, "[true,true,true,[7]]"),
    ] {
        assert_eq!(
            run::<Naive>(
                mixed_if::module,
                "snapshotObservation",
                Action::Call([condition.to_any()].to_array())
            ),
            Ok(expected.into())
        );
    }
}

#[test]
fn a_nested_function_return_keeps_its_owner() {
    for (condition, expected) in [(false, "1"), (true, "8")] {
        assert_eq!(
            run::<Naive>(
                mixed_if::module,
                "localOwner",
                Action::Call([condition.to_any()].to_array())
            ),
            Ok(expected.into())
        );
    }
}

#[test]
fn an_early_return_keeps_the_preceding_required_read() {
    assert_eq!(
        run::<Naive>(
            mixed_if::module,
            "requiredRead",
            Action::Call([true.to_any()].to_array())
        ),
        Ok("1".into())
    );
    assert!(matches!(
        run::<Naive>(
            mixed_if::module,
            "requiredRead",
            Action::Call([false.to_any()].to_array())
        ),
        Err(RunError::Thrown(_))
    ));
}

#[test]
fn mixed_owning_returns_and_self_tail_calls_stay_bounded() {
    for (n, expected) in [(0.0, "7"), (1.0, "8"), (100_001.0, "100008")] {
        assert_eq!(
            run::<Naive>(
                mixed_if::module,
                "tail",
                Action::Call([n.to_any(), 7.0.to_any()].to_array())
            ),
            Ok(expected.into())
        );
    }
}
