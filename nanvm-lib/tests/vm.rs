use nanvm_lib::{
    naive::{Any as NAny, BigInt, NaiveVm},
    sign::Sign,
    vm::Any as VmAny,
    interface::Container,
};

#[test]
fn test_vm_any_add() {
    let a = VmAny::<NaiveVm>::new(NAny::BigInt(BigInt::new(Sign::Positive, [1])));
    let b = VmAny::<NaiveVm>::new(NAny::BigInt(BigInt::new(Sign::Positive, [2])));
    let result = (a + b).unwrap();
    let expected = VmAny::<NaiveVm>::new(NAny::BigInt(BigInt::new(Sign::Positive, [3])));
    assert_eq!(result, expected);
}
