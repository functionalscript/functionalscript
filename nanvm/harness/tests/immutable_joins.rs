//! Common FAST preparation owns these joins before the Rust serializer runs.
//! No graph conversion can reconstruct the fixture's control flow first.

// Empty source arms retain their structure in the shared prepared plan.
#[allow(clippy::needless_else)]
#[path = "../gen.fast/immutable_joins.rs"]
mod immutable_joins;

use nanvm_harness::runtime;
use nanvm_lib::{
    naive::Naive,
    vm::{Any, Array, Function, Object, ToAny, ToArray},
};

fn exports() -> Object<Naive> {
    immutable_joins::module::<Naive>(runtime())
        .unwrap()
        .try_into()
        .unwrap()
}

fn function(exports: &Object<Naive>, name: &str) -> Function<Naive> {
    Function::try_from(exports.own_property(&name.into()).unwrap()).unwrap()
}

fn shared_result(value: Any<Naive>, expected: &str) -> Array<Naive> {
    let result = Array::try_from(value).unwrap();
    assert_eq!(result[0], result[1]);
    assert_eq!(result[0].clone().to_json(), Ok(expected.into()));
    let read = Function::try_from(result[2].clone()).unwrap();
    assert_eq!(read.call([].to_array()).unwrap(), result[0]);
    result
}

#[test]
fn all_parameterized_join_paths_keep_their_result_and_owning_return() {
    let exports = exports();
    let join = function(&exports, "parameterizedJoin");
    let operation = function(&exports, "operation");
    let failing = function(&exports, "failing");
    assert_eq!(join.length(), 3);

    for (selected, stop, expected) in [
        (false, false, "[5]"),
        (false, true, "[5]"),
        (true, false, "[8]"),
    ] {
        let call = || {
            join.call([selected.to_any(), stop.to_any(), operation.clone().to_any()].to_array())
                .unwrap()
        };
        let first = shared_result(call(), expected);
        let second = shared_result(call(), expected);
        assert_ne!(first[0], second[0]);
        let held = Function::try_from(first[2].clone()).unwrap();
        assert_eq!(held.call([].to_array()).unwrap(), first[0]);
    }

    assert_eq!(
        join.call([true.to_any(), true.to_any(), failing.clone().to_any()].to_array())
            .unwrap()
            .to_json(),
        Ok("42".into())
    );
    assert!(
        join.call([false.to_any(), false.to_any(), failing.to_any()].to_array())
            .is_err()
    );
}

#[test]
fn nested_join_preserves_normal_values_and_skips_unselected_callbacks() {
    let exports = exports();
    let nested = function(&exports, "nested");
    let operation = function(&exports, "operation");
    let normal = function(&exports, "factoryNormal");
    let early = function(&exports, "factoryEarly");
    let failing = function(&exports, "failing");
    assert_eq!(nested.length(), 4);

    shared_result(
        nested
            .call(
                [
                    false.to_any(),
                    5.0.to_any(),
                    failing.clone().to_any(),
                    operation.clone().to_any(),
                ]
                .to_array(),
            )
            .unwrap(),
        "[5]",
    );
    shared_result(
        nested
            .call(
                [
                    true.to_any(),
                    5.0.to_any(),
                    normal.clone().to_any(),
                    operation.to_any(),
                ]
                .to_array(),
            )
            .unwrap(),
        "[3]",
    );
    assert_eq!(
        nested
            .call(
                [
                    true.to_any(),
                    5.0.to_any(),
                    early.to_any(),
                    failing.clone().to_any(),
                ]
                .to_array(),
            )
            .unwrap()
            .to_json(),
        Ok("77".into())
    );
    assert!(
        nested
            .call(
                [
                    true.to_any(),
                    5.0.to_any(),
                    normal.to_any(),
                    failing.to_any(),
                ]
                .to_array(),
            )
            .is_err()
    );
}
