//! One public function retains tail, ordinary and returned self uses.
//! Closed capture identity is distinct from per-invocation result allocations.

#[path = "../gen.fast/mixed_self_uses.rs"]
mod mixed_self_uses;

use nanvm_harness::runtime;
use nanvm_lib::{
    common::sized_index::SizedIndex,
    naive::Naive,
    vm::{Any, Array, Function, ToAny, ToArray},
};

fn function() -> Function<Naive> {
    let call = Function::try_from(mixed_self_uses::module::<Naive>(runtime()).unwrap()).unwrap();
    assert_eq!(call.length(), 1);
    call
}

fn base_result(value: Any<Naive>, public: &Function<Naive>) -> Array<Naive> {
    let result = Array::try_from(value).unwrap();
    assert_eq!(result.length(), 4);
    assert_eq!(result[0], 9.0.to_any());
    assert_eq!(result[1], 7.0.to_any());
    assert_eq!(result[2].clone().to_json(), Ok("[]".into()));
    assert_eq!(result[3], public.clone().to_any());
    result
}

fn ordinary_result(value: Any<Naive>, public: &Function<Naive>) -> (Array<Naive>, Array<Naive>) {
    let pair = Array::try_from(value).unwrap();
    assert_eq!(pair.length(), 2);
    assert_eq!(pair[0], pair[1]);
    let result = base_result(pair[0].clone(), public);
    (pair, result)
}

#[test]
fn base_returns_the_public_self_and_stable_closed_captures() {
    let call = function();
    let first = base_result(call.call([0.0.to_any()].to_array()).unwrap(), &call);
    let second = base_result(call.call([0.0.to_any()].to_array()).unwrap(), &call);
    assert_ne!(first, second);
    assert_eq!(first[2], second[2]);
}

#[test]
fn ordinary_self_result_is_shared_once_per_invocation() {
    let call = function();
    let (first_pair, first) = ordinary_result(call.call([1.0.to_any()].to_array()).unwrap(), &call);
    let (second_pair, second) =
        ordinary_result(call.call([1.0.to_any()].to_array()).unwrap(), &call);
    assert_ne!(first_pair, second_pair);
    assert_ne!(first, second);
    assert_eq!(first[2], second[2]);
}

#[test]
fn deep_tail_transitions_keep_ordinary_calls_and_the_original_public_self() {
    let call = function();
    let (deep_pair, deep) =
        ordinary_result(call.call([100_001.0.to_any()].to_array()).unwrap(), &call);
    let (next_pair, next) = ordinary_result(call.call([1.0.to_any()].to_array()).unwrap(), &call);
    let base = base_result(call.call([0.0.to_any()].to_array()).unwrap(), &call);
    assert_ne!(deep_pair, next_pair);
    assert_ne!(deep, next);
    assert_ne!(deep, base);
    assert_ne!(next, base);
    assert_eq!(deep[2], next[2]);
    assert_eq!(deep[2], base[2]);
}
