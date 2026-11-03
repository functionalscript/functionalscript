//! Direct FAST joins and graph-derived wrappers share common preparation.
//! Native execution observes results, owning returns, sharing, and captures.

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
    let operation = function(&exports, "operation");
    let failing = function(&exports, "failing");

    for name in ["parameterizedJoin", "graphParameterizedJoin"] {
        let join = function(&exports, name);
        assert_eq!(join.length(), 3, "{name}");

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
            assert_ne!(first[0], second[0], "{name}");
            let held = Function::try_from(first[2].clone()).unwrap();
            assert_eq!(held.call([].to_array()).unwrap(), first[0], "{name}");
        }

        assert_eq!(
            join.call([true.to_any(), true.to_any(), failing.clone().to_any()].to_array())
                .unwrap()
                .to_json(),
            Ok("42".into()),
            "{name}"
        );
        assert!(
            join.call([false.to_any(), false.to_any(), failing.clone().to_any()].to_array())
                .is_err(),
            "{name}"
        );
    }
}

#[test]
fn nested_join_preserves_normal_values_and_skips_unselected_callbacks() {
    let exports = exports();
    let operation = function(&exports, "operation");
    let normal = function(&exports, "factoryNormal");
    let early = function(&exports, "factoryEarly");
    let failing = function(&exports, "failing");

    for name in ["nested", "graphNested"] {
        let nested = function(&exports, name);
        assert_eq!(nested.length(), 4, "{name}");

        for (selected, factory, expected) in [(false, &failing, "[5]"), (true, &normal, "[3]")] {
            let call = || {
                nested
                    .call(
                        [
                            selected.to_any(),
                            5.0.to_any(),
                            factory.clone().to_any(),
                            operation.clone().to_any(),
                        ]
                        .to_array(),
                    )
                    .unwrap()
            };
            let first = shared_result(call(), expected);
            let second = shared_result(call(), expected);
            assert_ne!(first[0], second[0], "{name}");
            let held = Function::try_from(first[2].clone()).unwrap();
            assert_eq!(held.call([].to_array()).unwrap(), first[0], "{name}");
        }

        assert_eq!(
            nested
                .call(
                    [
                        true.to_any(),
                        5.0.to_any(),
                        early.clone().to_any(),
                        failing.clone().to_any(),
                    ]
                    .to_array(),
                )
                .unwrap()
                .to_json(),
            Ok("77".into()),
            "{name}"
        );
        assert!(
            nested
                .call(
                    [
                        true.to_any(),
                        5.0.to_any(),
                        normal.clone().to_any(),
                        failing.clone().to_any(),
                    ]
                    .to_array(),
                )
                .is_err(),
            "{name}"
        );
    }
}

#[test]
fn genuine_graph_tail_recursion_remains_a_bounded_loop() {
    let tail_sum = function(&exports(), "graphTailSum");
    assert_eq!(tail_sum.length(), 2);
    for (n, expected) in [(0.0, "7"), (100_001.0, "100008")] {
        assert_eq!(
            tail_sum
                .call([n.to_any(), 7.0.to_any()].to_array())
                .unwrap()
                .to_json(),
            Ok(expected.into())
        );
    }
}
