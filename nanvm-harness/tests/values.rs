//! Compile an interpreted EDAG value through the Rust backend, then observe
//! its ordinary NaNVM callables. The fixture is generated from memo's result
//! by `fjs/nanvm/values`; no source module is reinterpreted by these tests.

#[path = "../gen.values/captures.rs"]
mod captures;

use nanvm_lib::{
    naive::Naive,
    vm::{Array, Function, Object, ToAny, ToArray},
};

#[test]
fn evaluated_captures_keep_their_values_and_identity() {
    let exports: Object<Naive> = captures::module::<Naive>().unwrap().try_into().unwrap();
    let shared = exports.own_property(&"shared".into()).unwrap();
    assert_eq!(shared.clone().to_json(), Ok("[3]".into()));
    assert_eq!(shared, exports.own_property(&"alias".into()).unwrap());

    let call = exports.own_property(&"call".into()).unwrap();
    let other = exports.own_property(&"other".into()).unwrap();
    assert_eq!(call, exports.own_property(&"again".into()).unwrap());
    assert_ne!(call, other);

    for (value, argument) in [(call, 3.0), (other, 4.0)] {
        let function = Function::try_from(value).unwrap();
        assert_eq!(function.length(), 1);
        let first: Array<Naive> = function
            .call([argument.to_any()].to_array())
            .unwrap()
            .try_into()
            .unwrap();
        let second: Array<Naive> = function
            .call([argument.to_any()].to_array())
            .unwrap()
            .try_into()
            .unwrap();
        assert_eq!(first[0], (argument + 2.0).to_any());
        assert_eq!(second[0], (argument + 2.0).to_any());
        assert_ne!(first, second);
        for result in [first, second] {
            assert_eq!(result[1], shared);
            assert_eq!(result[2], shared);
        }
    }
}

#[test]
fn each_module_construction_makes_fresh_values() {
    let first: Object<Naive> = captures::module::<Naive>().unwrap().try_into().unwrap();
    let second: Object<Naive> = captures::module::<Naive>().unwrap().try_into().unwrap();
    assert_ne!(first, second);
    for name in ["shared", "call", "other"] {
        assert_ne!(
            first.own_property(&name.into()).unwrap(),
            second.own_property(&name.into()).unwrap()
        );
    }
}
