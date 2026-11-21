use nanvm_lib::vm::{Any, Function, ToAny, ToArray, exports};

mod fixture {
    use nanvm_fjsrs::Vm as A;
    include!("generated/gen.strings.native.rs");
}

#[test]
fn closures_and_common_runtime_share_the_native_vm() {
    let module = exports(fixture::module).unwrap();
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
    assert_eq!(call("same"), true.to_any());
}
