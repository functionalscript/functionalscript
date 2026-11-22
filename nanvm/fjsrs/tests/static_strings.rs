use nanvm_lib::vm::{Any, Array, BigInt, Function, ToAny, ToArray, exports};

mod fixture {
    use nanvm_fjsrs::Vm as A;
    include!("generated/gen.strings.native.rs");
}

#[test]
fn closures_and_common_runtime_share_the_native_vm() {
    let module = exports(fixture::module).unwrap();
    let exported = Function::try_from(module.own_property(&"default".into()).unwrap()).unwrap();
    assert_eq!(exported.text().unwrap(), "()=>$0()".into());
    let call = |name: &str| {
        let value = module.own_property(&name.into()).unwrap();
        Function::try_from(value)
            .unwrap()
            .call([].to_array())
            .unwrap()
    };
    assert_eq!(
        call("default"),
        Any::from("very long stringvery long string")
    );
    assert_eq!(call("defaultKey"), Any::from("default"));
    assert_eq!(call("same"), true.to_any());
    let integers = Array::try_from(call("integers")).unwrap();
    for (i, expected) in ["0", "-1", "18446744073709551618", "18446744073709551618"]
        .into_iter()
        .enumerate()
    {
        assert_eq!(
            BigInt::try_from(integers[i as u32].clone())
                .unwrap()
                .to_string(),
            expected
        );
    }
}

#[test]
fn primitive_arrays_preserve_identity_and_contents() {
    let module = exports(fixture::module).unwrap();
    let get = |name: &str| module.own_property(&name.into()).unwrap();
    assert_eq!(get("first"), get("alias"));
    assert_ne!(get("first"), get("second"));
    let fresh = Function::try_from(get("fresh")).unwrap();
    assert_ne!(
        fresh.call([].to_array()).unwrap(),
        fresh.call([].to_array()).unwrap()
    );
    let mixed = Array::try_from(get("mixed")).unwrap();
    assert_eq!(mixed[0], 1.0.to_any());
    assert_eq!(mixed[1], Any::from("very long string"));
    assert_eq!(
        BigInt::try_from(mixed[2].clone()).unwrap().to_string(),
        "18446744073709551618"
    );
}

#[test]
fn primitive_objects_preserve_properties_and_identity() {
    let module = exports(fixture::module).unwrap();
    let get = |name: &str| module.own_property(&name.into()).unwrap();
    assert_eq!(get("record"), get("recordAlias"));
    assert_ne!(get("left"), get("right"));
    let record = nanvm_lib::vm::Object::try_from(get("record")).unwrap();
    assert_eq!(
        record.own_property(&"name".into()).unwrap(),
        Any::from("very long string")
    );
    assert_eq!(
        BigInt::try_from(record.own_property(&"count".into()).unwrap())
            .unwrap()
            .to_string(),
        "18446744073709551618"
    );
    let fresh = Function::try_from(get("emptyObject")).unwrap();
    assert_ne!(
        fresh.call([].to_array()).unwrap(),
        fresh.call([].to_array()).unwrap()
    );
}

#[test]
fn static_functions_preserve_identity_metadata_and_nested_calls() {
    let module = exports(fixture::module).unwrap();
    let reload = exports(fixture::module).unwrap();
    let get = |name: &str| module.own_property(&name.into()).unwrap();
    assert_eq!(get("id"), get("idAlias"));
    assert_eq!(get("id"), reload.own_property(&"id".into()).unwrap());
    let id = Function::try_from(get("id")).unwrap();
    assert_eq!(id.length(), 1);
    assert_eq!(id.text().unwrap(), "($0)=>$0".into());
    assert_eq!(id.call([42.0.to_any()].to_array()).unwrap(), 42.0.to_any());

    let make = Function::try_from(get("make")).unwrap();
    assert_ne!(
        make.call([].to_array()).unwrap(),
        make.call([].to_array()).unwrap()
    );
    let make_boolean = Function::try_from(get("makeBoolean")).unwrap();
    let boolean = Function::try_from(make_boolean.call([].to_array()).unwrap()).unwrap();
    for (value, expected) in [(0.0, false), (1.0, true)] {
        assert_eq!(
            boolean.call([value.to_any()].to_array()).unwrap(),
            expected.to_any()
        );
    }
}

#[test]
fn static_frames_retain_the_original_function_identity() {
    let module = exports(fixture::module).unwrap();
    let reload = exports(fixture::module).unwrap();
    let get = |name: &str| module.own_property(&name.into()).unwrap();
    for name in ["default", "capturedId", "capturedWrapper"] {
        assert_eq!(get(name), reload.own_property(&name.into()).unwrap());
    }
    let call = |name| {
        Function::try_from(get(name))
            .unwrap()
            .call([].to_array())
            .unwrap()
    };
    assert_eq!(call("capturedWrapper"), get("capturedId"));
    assert_eq!(call("capturedId"), get("id"));
    assert_eq!(
        call("default"),
        Any::from("very long stringvery long string")
    );
}
