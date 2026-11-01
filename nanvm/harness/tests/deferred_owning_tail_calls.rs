//! Deferred callable bodies are compiled from raw FAST, without interpreting
//! them during generation. Native calls observe their owning transfers.

// Raw structured empty branches and one-pass transfer regions remain intact;
// these semantic fixtures require no optimizer to remove that structure.
#[allow(clippy::needless_else, clippy::never_loop)]
#[path = "../gen.fast/deferred_owning_tail_calls.rs"]
mod deferred;

use nanvm_harness::runtime;
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Array, Function, Nullish, Object, ToAny, ToArray, unstable::string_any},
};

fn exports() -> Object<Naive> {
    deferred::module::<Naive>(runtime())
        .unwrap()
        .try_into()
        .unwrap()
}

fn function(exports: &Object<Naive>, name: &str) -> Function<Naive> {
    Function::try_from(exports.own_property(&name.into()).unwrap()).unwrap()
}

#[test]
fn deferred_owning_returns_run_deeply_through_loops_and_aliases() {
    let exports = exports();
    for name in [
        "terminal",
        "ordinary",
        "nestedRecipe",
        "insideAlias",
        "outsideAlias",
    ] {
        let call = function(&exports, name);
        assert_eq!(call.length(), 1);
        for n in [0.0, 100_001.0] {
            assert_eq!(
                call.call([n.to_any()].to_array()).unwrap().to_json(),
                Ok("7".into()),
                "{name}({n})"
            );
        }
    }
}

#[test]
fn local_loop_state_restarts_before_each_deferred_tail_call() {
    let call = function(&exports(), "localReset");
    assert_eq!(call.length(), 2);
    for (n, expected) in [(3.0, "8"), (100_001.0, "200004")] {
        assert_eq!(
            call.call([n.to_any(), 0.0.to_any()].to_array())
                .unwrap()
                .to_json(),
            Ok(expected.into())
        );
    }
}

#[test]
fn selected_tail_values_read_one_argument_snapshot() {
    let call = function(&exports(), "tailValues");
    assert_eq!(call.length(), 3);
    for (n, expected) in [(0.0, "[1,2]"), (100_001.0, "[2,1]")] {
        assert_eq!(
            call.call([n.to_any(), 1.0.to_any(), 2.0.to_any()].to_array())
                .unwrap()
                .to_json(),
            Ok(expected.into())
        );
    }
}

#[test]
fn captures_keep_their_creating_invocation() {
    let call = function(&exports(), "captures");
    assert_eq!(call.length(), 2);
    let first: Array<Naive> = call
        .call([100_001.0.to_any(), Nullish::Null.to_any()].to_array())
        .unwrap()
        .try_into()
        .unwrap();
    let second: Array<Naive> = call
        .call([2.0.to_any(), Nullish::Null.to_any()].to_array())
        .unwrap()
        .try_into()
        .unwrap();
    for result in [&first, &second] {
        assert_eq!(result.clone().to_any().to_json(), Ok("[[0],[1]]".into()));
        assert_ne!(result[0], result[1]);
    }
    assert_ne!(first[0], second[0]);
    assert_ne!(first[1], second[1]);
}

#[test]
fn rest_snapshots_stay_shared_within_one_invocation() {
    let call = function(&exports(), "rest");
    assert_eq!(call.length(), 2);
    let first: Array<Naive> = call
        .call([100_001.0.to_any(), Nullish::Null.to_any(), 9.0.to_any()].to_array())
        .unwrap()
        .try_into()
        .unwrap();
    assert_ne!(first[0], first[1]);
    assert_eq!(first[1], first[2]);
    assert_eq!(first[0].clone().to_json(), Ok("[9]".into()));
    assert_eq!(first[1].clone().to_json(), Ok("[9]".into()));
    let held = Function::try_from(first[3].clone()).unwrap();
    assert_eq!(held.call([].to_array()).unwrap(), first[1]);

    let second: Array<Naive> = call
        .call([2.0.to_any(), Nullish::Null.to_any(), 9.0.to_any()].to_array())
        .unwrap()
        .try_into()
        .unwrap();
    assert_ne!(second[0], second[1]);
    assert_eq!(second[1], second[2]);
    assert_ne!(first[1], second[1]);
    assert_eq!(held.call([].to_array()).unwrap(), first[1]);
}

#[test]
fn rest_only_tail_calls_keep_their_public_arity() {
    let call = function(&exports(), "restOnly");
    assert_eq!(call.length(), 0);
    for (n, expected) in [(3.0, "3"), (100_001.0, "100001")] {
        assert_eq!(
            call.call([n.to_any(), 0.0.to_any()].to_array())
                .unwrap()
                .to_json(),
            Ok(expected.into())
        );
    }
}

#[test]
fn extra_arguments_and_spreads_keep_their_selected_failures() {
    let exports = exports();
    let extra = function(&exports, "extraArguments");
    assert_eq!(extra.length(), 2);
    for (n, selected, expected) in [(100_001.0, false, "7"), (0.0, true, "7"), (-1.0, true, "9")] {
        assert_eq!(
            extra
                .call([n.to_any(), selected.to_any()].to_array())
                .unwrap()
                .to_json(),
            Ok(expected.into())
        );
    }
    assert!(
        extra
            .call([1.0.to_any(), true.to_any()].to_array())
            .is_err()
    );

    let spread = function(&exports, "failedSpread");
    assert_eq!(spread.length(), 1);
    assert_eq!(
        spread.call([0.0.to_any()].to_array()).unwrap().to_json(),
        Ok("7".into())
    );
    assert!(spread.call([1.0.to_any()].to_array()).is_err());
}

#[test]
fn normal_payloads_keep_their_sharing_and_opaque_tags() {
    let call = function(&exports(), "normalPayload");
    assert_eq!(call.length(), 3);
    for (n, tail, result_n) in [(3.0, false, 3), (100_001.0, true, 0)] {
        for tag in ["tail", "return", "normal"] {
            let result: Array<Naive> = call
                .call([n.to_any(), tail.to_any(), string_any(tag)].to_array())
                .unwrap()
                .try_into()
                .unwrap();
            assert_eq!(result[0], result[1]);
            assert_eq!(
                result[0].clone().to_json(),
                Ok(format!("[\"{tag}\",[{result_n}]]"))
            );
        }
    }
}

#[test]
fn a_non_tail_self_call_still_produces_its_result() {
    let call = function(&exports(), "nonTail");
    assert_eq!(call.length(), 1);
    let result: Any<Naive> = call.call([3.0.to_any()].to_array()).unwrap();
    assert_eq!(result.to_json(), Ok("3".into()));
}
