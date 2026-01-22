use nanvm_lib::{
    interface::{Any, WAny},
    naive,
    sign::Sign,
};

fn big_int_add<A: Any>() {
    let n0: WAny<A> = WAny::big_int(Sign::Positive, []);
    assert_eq!((n0.clone() + n0.clone()).unwrap(), n0);
}

fn big_int_mul<A: Any>() -> Result<(), WAny<A>> {
    let n0: WAny<A> = WAny::big_int(Sign::Positive, []);
    let n1: WAny<A> = WAny::big_int(Sign::Positive, [1]);
    assert_eq!((n1.clone() * n0.clone())?, n0);
    assert_eq!((n0.clone() * n1.clone())?, n0);

    let n_minus1: WAny<A> = WAny::big_int(Sign::Negative, [1]);
    assert_eq!((n_minus1.clone() * n0.clone())?, n0);
    assert_eq!((n0.clone() * n_minus1.clone())?, n0);
    assert_eq!((n_minus1.clone() * n_minus1.clone())?, n1);

    let a: WAny<A> = WAny::big_int(Sign::Positive, [1, 2, 3, 4]);
    let b: WAny<A> = WAny::big_int(Sign::Positive, [5, 6, 7]);
    let expected: WAny<A> = WAny::big_int(Sign::Positive, [5, 16, 34, 52, 45, 28]);
    assert_eq!((a.clone() * b.clone())?, expected);
    assert_eq!((b.clone() * a.clone())?, expected);

    let a: WAny<A> = WAny::big_int(Sign::Negative, [u64::MAX]);
    let expected: WAny<A> = WAny::big_int(Sign::Positive, [1, u64::MAX - 1]);
    assert_eq!((a.clone() * a.clone())?, expected);

    let b: WAny<A> = WAny::big_int(Sign::Negative, [u64::MAX, u64::MAX, u64::MAX]);
    let expected: WAny<A> = WAny::big_int(Sign::Positive, [1, u64::MAX, u64::MAX, u64::MAX - 1]);
    assert_eq!((a.clone() * b.clone())?, expected);
    assert_eq!((b.clone() * a.clone())?, expected);
    Ok(())
}

fn test_vm<A: Any>() {
    big_int_add::<A>();
    big_int_mul::<A>().unwrap();
}

#[test]
fn test() {
    test_vm::<naive::Any>();
}
