use nanvm_lib::{
    interface::{Any, Complex, Container, Extension, Unpacked, Utf8, WAny},
    naive,
    nullish::Nullish,
    sign::Sign,
    simple::Simple,
};

fn assert_is_nan<A: Any>(a: A, test_case: &str) {
    let nan = Any::unary_plus(a).unwrap();
    let Some(Simple::Number(f)) = nan.try_to_simple() else {
        panic!("expected Simple result of unary_plus of '{}'", test_case);
    };
    assert!(f.is_nan());
}

fn test_op<A: Any>(result: A, expected: A, test_case: &str) {
    match A::unpack(expected.clone()) {
        Unpacked::Number(f) => {
            if f.is_nan() {
                assert_is_nan(result, test_case);
            } else {
                assert_eq!(result, expected);
            }
        }
        Unpacked::BigInt(_) => {
            assert_eq!(result, expected);
        }
        _ => panic!("expected is neither Number nor BigInt in '{}'", test_case),
    }
}

fn multiply<A: Any>() {
    let n0: A = Simple::Number(0.0).to_unknown();
    let n1: A = Simple::Number(1.0).to_unknown();
    let n_minus1: A = Simple::Number(-1.0).to_unknown();
    let n10: A = Simple::Number(10.0).to_unknown();
    let n_minus10: A = Simple::Number(-10.0).to_unknown();
    let nan: A = Simple::Number(f64::NAN).to_unknown();
    let null: A = Simple::Nullish(Nullish::Null).to_unknown();
    let true_: A = Simple::Boolean(true).to_unknown();
    let false_: A = Simple::Boolean(false).to_unknown();
    let bi0: A = A::BigInt::new(Sign::Positive, []).to_unknown();
    let bi1: A = A::BigInt::new(Sign::Positive, [1]).to_unknown();
    let bi_minus1: A = A::BigInt::new(Sign::Negative, [1]).to_unknown();
    let bi10: A = A::BigInt::new(Sign::Positive, [10]).to_unknown();
    let bi_minus10: A = A::BigInt::new(Sign::Negative, [10]).to_unknown();
    let test_cases: &[(A, A, A, &str)] = &[
        (null.clone(), null.clone(), n0.clone(), "null by null"),
        (null.clone(), n0.clone(), n0.clone(), "null by 0"),
        (
            Simple::Nullish(Nullish::Undefined).to_unknown(),
            n0.clone(),
            nan.clone(),
            "undefined by 0",
        ),
        (true_.clone(), n0.clone(), n0.clone(), "boolean true by 0"),
        (true_.clone(), n1.clone(), n1.clone(), "boolean true by 1"),
        (
            true_.clone(),
            n10.clone(),
            n10.clone(),
            "boolean true by 10",
        ),
        (false_.clone(), n0.clone(), n0.clone(), "boolean false by 0"),
        (false_.clone(), n1.clone(), n0.clone(), "boolean false by 1"),
        (
            false_.clone(),
            n10.clone(),
            n0.clone(),
            "boolean false by 10",
        ),
        (n0.clone(), n0.clone(), n0.clone(), "0 by 0"),
        (n0.clone(), n1.clone(), n0.clone(), "0 by 1"),
        (n1.clone(), n1.clone(), n1.clone(), "1 by 1"),
        (n1.clone(), n_minus1.clone(), n_minus1.clone(), "1 by -1"),
        (n1.clone(), n10.clone(), n10.clone(), "1 by 10"),
        (n_minus1.clone(), n10.clone(), n_minus10.clone(), "-1 by 10"),
        (
            n10.clone(),
            n10.clone(),
            Simple::Number(100.0).to_unknown(),
            "10 by 10",
        ),
        (
            n_minus10.clone(),
            n10.clone(),
            Simple::Number(-100.0).to_unknown(),
            "-10 by 10",
        ),
        (bi0.clone(), bi0.clone(), bi0.clone(), "0n by 0n"),
        (bi0.clone(), bi1.clone(), bi0.clone(), "0n by 1n"),
        (bi1.clone(), bi1.clone(), bi1.clone(), "1n by 1n"),
        (
            bi1.clone(),
            bi_minus1.clone(),
            bi_minus1.clone(),
            "1n by -1n",
        ),
        (bi1.clone(), bi10.clone(), bi10.clone(), "1n by 10n"),
        (
            bi_minus1.clone(),
            bi10.clone(),
            A::BigInt::new(Sign::Negative, [10]).to_unknown(),
            "-1n by 10n",
        ),
        (
            bi10.clone(),
            bi10.clone(),
            A::BigInt::new(Sign::Positive, [100]).to_unknown(),
            "10n by 10n",
        ),
        (
            bi_minus10.clone(),
            bi10.clone(),
            A::BigInt::new(Sign::Negative, [100]).to_unknown(),
            "-10n by 10n",
        ),
        ("".to_unknown(), n1.clone(), n0.clone(), "\"\" by 1"),
        ("10".to_unknown(), n1.clone(), n10.clone(), "\"10\" by 1"),
        ("a".to_unknown(), n1.clone(), nan.clone(), "\"a\" by 1"),
        ("1n".to_unknown(), n1.clone(), nan.clone(), "\"1n\" by 1"),
        ([].to_array_unknown(), n1.clone(), n0.clone(), "[] by 1"),
        (
            [n10.clone()].to_array_unknown(),
            n1.clone(),
            n10.clone(),
            "[10] by 1",
        ),
        (
            ["10".to_unknown()].to_array_unknown(),
            n1.clone(),
            n10.clone(),
            "[\"10\"] by 1",
        ),
        (
            [n0.clone(), n0.clone()].to_array_unknown(),
            n1.clone(),
            nan.clone(),
            "[\"0,0\"] by 1",
        ),
        ([].to_object_unknown(), n1.clone(), nan.clone(), "{{}} by 1"),
        // TODO: decide on testing objects with valueOf, toString functions.
    ];
    for (a, b, expected, test_case) in test_cases.iter() {
        test_op::<A>(
            Any::mul(a.clone(), b.clone()).unwrap(),
            expected.clone(),
            test_case,
        );
        test_op::<A>(
            Any::mul(b.clone(), a.clone()).unwrap(),
            expected.clone(),
            test_case,
        );
    }
}

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
    multiply::<A>();
    big_int_add::<A>();
    big_int_mul::<A>().unwrap();
}

#[test]
fn test() {
    test_vm::<naive::Any>();
}
