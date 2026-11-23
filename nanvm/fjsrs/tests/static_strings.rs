use nanvm_lib::vm::{Any, Array, BigInt, Function, ToAny, ToArray, exports_with_runtime};

mod fixture {
    use nanvm_fjsrs::Vm as A;
    include!("generated/gen.strings.native.rs");
}

#[test]
fn closures_and_common_runtime_share_the_native_vm() {
    let module = exports_with_runtime(fixture::module, nanvm_fjsrs::runtime().unwrap()).unwrap();
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
    let module = exports_with_runtime(fixture::module, nanvm_fjsrs::runtime().unwrap()).unwrap();
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
    let module = exports_with_runtime(fixture::module, nanvm_fjsrs::runtime().unwrap()).unwrap();
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
    let module = exports_with_runtime(fixture::module, nanvm_fjsrs::runtime().unwrap()).unwrap();
    let reload = exports_with_runtime(fixture::module, nanvm_fjsrs::runtime().unwrap()).unwrap();
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
    let module = exports_with_runtime(fixture::module, nanvm_fjsrs::runtime().unwrap()).unwrap();
    let reload = exports_with_runtime(fixture::module, nanvm_fjsrs::runtime().unwrap()).unwrap();
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

#[test]
fn native_runtime_shares_its_object_is_builtin() {
    let runtime = nanvm_fjsrs::runtime().unwrap();
    let lookup = || nanvm_lib::vm::unstable::static_read(&runtime, "Object.is").unwrap();
    let is = Function::try_from(lookup()).unwrap();
    assert_eq!(is.clone().to_any(), lookup());
    assert_eq!(is.text().unwrap(), "function is() { [native code] }".into());
    assert_eq!(
        is.call([0.0.to_any(), (-0.0).to_any()].to_array()).unwrap(),
        false.to_any()
    );
}

#[test]
fn native_dot_creates_fresh_functions_bound_to_the_receiver() {
    let runtime = nanvm_fjsrs::runtime().unwrap();
    let dot = Function::try_from(runtime.dot("dot".into()).end().unwrap()).unwrap();
    let bind = |receiver: &str| {
        dot.call([receiver.into(), "startsWith".into()].to_array())
            .unwrap()
    };
    let first = bind("abc");
    assert_ne!(first, bind("abc"));
    let starts_with_a = |bound| {
        Function::try_from(bound)
            .unwrap()
            .call(["a".into()].to_array())
            .unwrap()
    };
    assert_eq!(starts_with_a(first), true.to_any());
    assert_eq!(starts_with_a(bind("bcd")), false.to_any());
}

#[test]
fn static_object_members_share_the_exported_function() {
    let load = || exports_with_runtime(fixture::module, nanvm_fjsrs::runtime().unwrap()).unwrap();
    let module = load();
    let table = module.own_property(&"functionTable".into()).unwrap();
    assert_eq!(load().own_property(&"functionTable".into()).unwrap(), table);
    let reload = load();
    for (key, expected) in [("readTable", table.clone()), ("callTable", 7.0.to_any())] {
        let wrapper = module.own_property(&key.into()).unwrap();
        assert_eq!(wrapper, reload.own_property(&key.into()).unwrap());
        assert_eq!(
            Function::try_from(wrapper)
                .unwrap()
                .call([].to_array())
                .unwrap(),
            expected
        );
    }
    let table = nanvm_lib::vm::Object::try_from(table).unwrap();
    let id = module.own_property(&"id".into()).unwrap();
    for key in ["f", "alias"] {
        let value = table.own_property(&key.into()).unwrap();
        assert_eq!(value, id);
        assert_eq!(
            Function::try_from(value)
                .unwrap()
                .call([42.0.to_any()].to_array())
                .unwrap(),
            42.0.to_any()
        );
    }
    let fresh = Function::try_from(module.own_property(&"freshTable".into()).unwrap()).unwrap();
    assert_ne!(
        fresh.call([].to_array()).unwrap(),
        fresh.call([].to_array()).unwrap()
    );
}

#[test]
fn nested_static_objects_preserve_identity_across_module_loads() {
    let load = || exports_with_runtime(fixture::module, nanvm_fjsrs::runtime().unwrap()).unwrap();
    let module = load();
    let table = module.own_property(&"functionTable".into()).unwrap();
    let tables = module.own_property(&"tables".into()).unwrap();
    let reload = load();
    assert_eq!(reload.own_property(&"tables".into()).unwrap(), tables);
    assert_eq!(reload.own_property(&"functionTable".into()).unwrap(), table);
    let tables = nanvm_lib::vm::Object::try_from(tables).unwrap();
    for key in ["table", "alias"] {
        assert_eq!(tables.own_property(&key.into()).unwrap(), table);
    }
    let factory = Function::try_from(module.own_property(&"freshTables".into()).unwrap()).unwrap();
    let fresh = || factory.call([].to_array()).unwrap();
    let first = fresh();
    assert_ne!(first, fresh());
    let first = nanvm_lib::vm::Object::try_from(first).unwrap();
    assert_eq!(first.own_property(&"table".into()).unwrap(), table);
}

#[test]
fn static_array_entries_share_the_exported_function_and_object() {
    let load = || exports_with_runtime(fixture::module, nanvm_fjsrs::runtime().unwrap()).unwrap();
    let module = load();
    let items = module.own_property(&"items".into()).unwrap();
    assert_eq!(load().own_property(&"items".into()).unwrap(), items);
    let items = Array::try_from(items).unwrap();
    let table = module.own_property(&"functionTable".into()).unwrap();
    assert_eq!(items[0], module.own_property(&"id".into()).unwrap());
    assert_eq!(items[1], table);
    assert_eq!(items[2], table);
    let factory = Function::try_from(module.own_property(&"freshItems".into()).unwrap()).unwrap();
    let fresh = || factory.call([].to_array()).unwrap();
    let first = fresh();
    assert_ne!(first, fresh());
    assert_eq!(Array::try_from(first).unwrap()[0], table);
}
