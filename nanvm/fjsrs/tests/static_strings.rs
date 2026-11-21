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
