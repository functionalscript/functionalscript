//! Independent shared terminal recipes use the common tail planner.
//! Native execution checks bounded depth, selected work, and invocation frames.

#[path = "../gen.fast/independent_tail_recipes.rs"]
mod independent;

use nanvm_harness::runtime;
use nanvm_lib::{
    naive::Naive,
    vm::{Array, Function, Nullish, Object, ToAny, ToArray},
};

fn exports() -> Object<Naive> {
    independent::module::<Naive>(runtime())
        .unwrap()
        .try_into()
        .unwrap()
}

fn function(exports: &Object<Naive>, name: &str) -> Function<Naive> {
    Function::try_from(exports.own_property(&name.into()).unwrap()).unwrap()
}

#[test]
fn independent_shared_calls_run_deeply_for_both_selections() {
    let call = function(&exports(), "scalar");
    assert_eq!(call.length(), 2);
    for n in [0.0, 1.0, 2.0, 7.0, 100_001.0] {
        for selected in [false, true] {
            assert_eq!(
                call.call([n.to_any(), selected.to_any()].to_array())
                    .unwrap()
                    .to_json(),
                Ok("0".into()),
                "({n}, {selected})"
            );
        }
    }
}

#[test]
fn independent_recipes_keep_distinct_argument_vectors() {
    let call = function(&exports(), "vectors");
    assert_eq!(call.length(), 4);
    let left = [11.0.to_any()].to_array().to_any();
    let right = [22.0.to_any()].to_array().to_any();
    for (selected, expected_left, expected_right) in [
        (false, left.clone(), right.clone()),
        (true, right.clone(), left.clone()),
    ] {
        let result = Array::try_from(
            call.call([2.0.to_any(), selected.to_any(), left.clone(), right.clone()].to_array())
                .unwrap(),
        )
        .unwrap();
        assert_eq!(result[0], expected_left);
        assert_eq!(result[1], expected_right);
    }
    let shared = Array::try_from(
        call.call([2.0.to_any(), true.to_any(), left.clone(), left.clone()].to_array())
            .unwrap(),
    )
    .unwrap();
    assert_eq!(shared[0], left);
    assert_eq!(shared[1], left);

    let deep = Array::try_from(
        call.call(
            [
                100_001.0.to_any(),
                false.to_any(),
                left.clone(),
                right.clone(),
            ]
            .to_array(),
        )
        .unwrap(),
    )
    .unwrap();
    assert_eq!(deep[0], right);
    assert_eq!(deep[1], left);
}

#[test]
fn only_the_selected_recipe_evaluates_its_failing_extra_argument() {
    let call = function(&exports(), "selectedFailure");
    assert_eq!(call.length(), 3);
    for (n, selected, fail) in [
        (0.0, false, true),
        (0.0, true, true),
        (1.0, false, true),
        (1.0, true, false),
        (100_001.0, false, false),
    ] {
        assert_eq!(
            call.call([n.to_any(), selected.to_any(), fail.to_any()].to_array())
                .unwrap()
                .to_json(),
            Ok("0".into())
        );
    }
    assert!(
        call.call([1.0.to_any(), true.to_any(), true.to_any()].to_array())
            .is_err()
    );
}

fn snapshot(call: &Function<Naive>, n: f64, selected: bool) -> Array<Naive> {
    let result = Array::try_from(
        call.call([n.to_any(), selected.to_any(), Nullish::Null.to_any()].to_array())
            .unwrap(),
    )
    .unwrap();
    assert_eq!(result[0], result[1]);
    assert_eq!(result[0].clone().to_json(), Ok("[0]".into()));
    assert_eq!(result[3].clone().to_json(), Ok("[1]".into()));
    assert_ne!(result[0], result[3]);
    let read = Function::try_from(result[2].clone()).unwrap();
    assert_eq!(read.length(), 0);
    assert_eq!(read.call([].to_array()).unwrap(), result[0]);
    result
}

#[test]
fn allocations_and_captured_readers_keep_their_invocation() {
    let call = function(&exports(), "snapshots");
    assert_eq!(call.length(), 3);
    let first = snapshot(&call, 100_001.0, false);
    let held = Function::try_from(first[2].clone()).unwrap();
    for selected in [false, true] {
        let next = snapshot(&call, 2.0, selected);
        assert_ne!(first[0], next[0]);
        assert_ne!(first[3], next[3]);
        assert_eq!(held.call([].to_array()).unwrap(), first[0]);
    }
}
