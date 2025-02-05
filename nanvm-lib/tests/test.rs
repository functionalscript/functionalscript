use core::panic;

use nanvm_lib::{
    big_int,
    interface::{Any, Complex, Container, Extension, Unpacked, Utf8},
    naive,
    nullish::Nullish,
    sign::Sign,
    simple::Simple,
};

use wasm_bindgen_test::wasm_bindgen_test;

fn eq<A: Any>() {
    // nullish
    let null0: A = Simple::Nullish(Nullish::Null).to_unknown();
    let null1 = Simple::Nullish(Nullish::Null).to_unknown();
    let undefined0 = Simple::Nullish(Nullish::Undefined).to_unknown();
    let undefined1 = Simple::Nullish(Nullish::Undefined).to_unknown();
    {
        assert_eq!(null0, null1);
        assert_eq!(undefined0, undefined1);
        assert_ne!(null1, undefined0);
    }
    // boolean
    let true0: A = Simple::Boolean(true).to_unknown();
    let true1 = Simple::Boolean(true).to_unknown();
    let false0 = Simple::Boolean(false).to_unknown();
    let false1 = Simple::Boolean(false).to_unknown();
    {
        // boolean
        {
            assert_eq!(true0, true1);
            assert_eq!(false0, false1);
            assert_ne!(true0, false0);
        }
        // nullish
        {
            assert_ne!(false0, undefined0);
            assert_ne!(false0, null0);
        }
    }
    // number
    let number00: A = Simple::Number(2.3).to_unknown();
    let number01: A = Simple::Number(2.3).to_unknown();
    let number1: A = Simple::Number(-5.4).to_unknown();
    let number_nan: A = Simple::Number(f64::NAN).to_unknown();
    let number_p0: A = Simple::Number(0.0).to_unknown();
    let number_n0: A = Simple::Number(-0.0).to_unknown();
    let number_p_inf0: A = Simple::Number(f64::INFINITY).to_unknown();
    let number_p_inf1: A = Simple::Number(f64::INFINITY).to_unknown();
    let number_n_inf0: A = Simple::Number(-f64::INFINITY).to_unknown();
    let number_n_inf1: A = Simple::Number(-f64::INFINITY).to_unknown();
    {
        // number
        {
            assert_eq!(number00, number01);
            assert_ne!(number00, number1);
            assert_ne!(number_nan, number_nan);
            assert_eq!(number_p0, number_n0);
            // Object.is()
            assert_eq!((-0f64).to_bits(), (-0f64).to_bits());
            assert_ne!(0f64.to_bits(), (-0f64).to_bits());
            assert_eq!(number_p_inf0, number_p_inf1);
            assert_eq!(number_n_inf0, number_n_inf1);
            assert_ne!(number_p_inf0, number_n_inf0);
        }
        // nullish
        {
            assert_ne!(number_nan, undefined0);
            assert_ne!(number00, undefined0);
        }
    }
    // string
    let string_hello0: A = "Hello!".to_unknown();
    let string_hello1: A = "Hello!".to_unknown();
    let string_world0: A = "world!".to_unknown();
    let string0: A = "0".to_unknown();
    let s0 = "0".to_string16::<A>();
    {
        {
            assert_eq!(string_hello0, string_hello1);
            assert_ne!(string_hello0, string_world0);
        }
        {
            assert_ne!(number_p0, string0.clone());
        }
    }
    // bigint
    let bigint12_0: A = A::BigInt::new(Sign::Positive, [12]).to_unknown();
    let bigint12_1: A = A::BigInt::new(Sign::Positive, [12]).to_unknown();
    let bigint12m: A = A::BigInt::new(Sign::Negative, [12]).to_unknown();
    let bigint13: A = A::BigInt::new(Sign::Positive, [13]).to_unknown();
    {
        assert_eq!(bigint12_0, bigint12_1);
        assert_ne!(bigint12_0, bigint12m);
        assert_ne!(bigint12_0, bigint13);
    }
    // array
    let array0: A = [].to_array_unknown();
    let array1: A = [].to_array_unknown();
    let array2: A = [string0.clone()].to_array_unknown();
    {
        assert_eq!(array0, array0);
        assert_ne!(array0, array1);
        assert_eq!(array2, array2);
    }
    // object
    let object0: A = [(s0.clone(), string0.clone())].to_object_unknown();
    let object1: A = [(s0, string0)].to_object_unknown();
    {
        assert_eq!(object0, object0);
        assert_ne!(object0, object1);
    }
}

fn assert_is_nan<A: Any>(a: A, test_case: &str) {
    let nan = Any::unary_plus(a).unwrap();
    if let Some(simple) = nan.try_to_simple() {
        match simple {
            Simple::Number(f) => {
                assert!(f.is_nan());
            }
            _ => panic!("expected Number result of unary_plus of '{}'", test_case),
        }
    } else {
        panic!("expected Simple result of unary_plus of '{}'", test_case);
    }
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

fn unary_plus<A: Any>() {
    let n0: A = Simple::Number(0.0).to_unknown();
    let nan: A = Simple::Number(f64::NAN).to_unknown();
    let null: A = Simple::Nullish(Nullish::Null).to_unknown();
    let test_cases: Vec<(A, A, &str)> = vec![
        (null.clone(), n0.clone(), "null"),
        (
            Simple::Nullish(Nullish::Undefined).to_unknown(),
            nan.clone(),
            "undefined",
        ),
        (
            Simple::Boolean(true).to_unknown(),
            Simple::Number(1.0).to_unknown(),
            "boolean true",
        ),
        (
            Simple::Boolean(false).to_unknown(),
            n0.clone(),
            "boolean false",
        ),
        (n0.clone(), Simple::Number(0.0).to_unknown(), "number 0"),
        (
            Simple::Number(2.3).to_unknown(),
            Simple::Number(2.3).to_unknown(),
            "number 2.3",
        ),
        (
            Simple::Number(-2.3).to_unknown(),
            Simple::Number(-2.3).to_unknown(),
            "number -2.3",
        ),
        ("".to_unknown(), n0.clone(), "string \"\""),
        ("0".to_unknown(), n0.clone(), "string \"0\""),
        (
            "2.3e2".to_unknown(),
            Simple::Number(2.3e2).to_unknown(),
            "string \"2.3e2\"",
        ),
        ("a".to_unknown(), nan.clone(), "string \"a\""),
        ([].to_array_unknown(), n0.clone(), "array []"),
        (
            [Simple::Number(-0.3).to_unknown()].to_array_unknown(),
            Simple::Number(-0.3).to_unknown(),
            "array [-0.3]",
        ),
        (
            ["0.3".to_unknown()].to_array_unknown(),
            Simple::Number(0.3).to_unknown(),
            "array [\"0.3\"]",
        ),
        (
            [null.clone()].to_array_unknown(),
            n0.clone(),
            "array [null]",
        ),
        (
            [null.clone(), null.clone()].to_array_unknown(),
            nan.clone(),
            "array [null,null]",
        ),
        ([].to_object_unknown(), nan.clone(), "object {{}}"),
        // TODO: decide on testing objects with valueOf, toString functions.
        (
            A::Function::new(0, [0]).to_unknown(),
            nan.clone(),
            "function",
        ),
    ];
    for (a, expected, test_case) in test_cases.iter() {
        test_op::<A>(
            Any::unary_plus(a.clone()).unwrap(),
            expected.clone(),
            test_case,
        );
    }

    // bigint
    let bi0: A = A::BigInt::new(Sign::Positive, [0]).to_unknown();
    assert_eq!(
        Any::unary_plus(bi0),
        A::exception("TypeError: Cannot convert a BigInt value to a number")
    );
}

fn unary_minus<A: Any>() {
    let n0: A = Simple::Number(0.0).to_unknown();
    let nan: A = Simple::Number(f64::NAN).to_unknown();
    let null: A = Simple::Nullish(Nullish::Null).to_unknown();
    let test_cases: Vec<(A, A, &str)> = vec![
        (null.clone(), n0.clone(), "null"),
        (
            Simple::Nullish(Nullish::Undefined).to_unknown(),
            nan.clone(),
            "undefined",
        ),
        (
            Simple::Boolean(true).to_unknown(),
            Simple::Number(-1.0).to_unknown(),
            "boolean true",
        ),
        (
            Simple::Boolean(false).to_unknown(),
            n0.clone(),
            "boolean false",
        ),
        (n0.clone(), Simple::Number(0.0).to_unknown(), "number 0"),
        (
            Simple::Number(-2.3).to_unknown(),
            Simple::Number(2.3).to_unknown(),
            "number -2.3",
        ),
        (
            Simple::Number(2.3).to_unknown(),
            Simple::Number(-2.3).to_unknown(),
            "number 2.3",
        ),
        ("".to_unknown(), n0.clone(), "string \"\""),
        ("0".to_unknown(), n0.clone(), "string \"0\""),
        (
            "2.3e2".to_unknown(),
            Simple::Number(-2.3e2).to_unknown(),
            "string \"2.3e2\"",
        ),
        ("a".to_unknown(), nan.clone(), "string \"a\""),
        ([].to_array_unknown(), n0.clone(), "array []"),
        (
            A::BigInt::new(Sign::Positive, [1]).to_unknown(),
            A::BigInt::new(Sign::Negative, [1]).to_unknown(),
            "bigint 1n",
        ),
        (
            [Simple::Number(-0.3).to_unknown()].to_array_unknown(),
            Simple::Number(0.3).to_unknown(),
            "array [-0.3]",
        ),
        (
            ["0.3".to_unknown()].to_array_unknown(),
            Simple::Number(-0.3).to_unknown(),
            "array [\"-0.3\"]",
        ),
        (
            [null.clone()].to_array_unknown(),
            n0.clone(),
            "array [null]",
        ),
        (
            [null.clone(), null.clone()].to_array_unknown(),
            nan.clone(),
            "array [null,null]",
        ),
        ([].to_object_unknown(), nan.clone(), "object {{}}"),
        // TODO: decide on testing objects with valueOf, toString functions.
        (
            A::Function::new(0, [0]).to_unknown(),
            nan.clone(),
            "function",
        ),
    ];
    for (a, expected, test_case) in test_cases.iter() {
        test_op::<A>(Any::unary_minus(a.clone()), expected.clone(), test_case);
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
    let test_cases: Vec<(A, A, A, &str)> = vec![
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
            Any::multiply(a.clone(), b.clone()).unwrap(),
            expected.clone(),
            test_case,
        );
        test_op::<A>(
            Any::multiply(b.clone(), a.clone()).unwrap(),
            expected.clone(),
            test_case,
        );
    }
}

fn big_int_mul<A: Any>() {
    let n0 = A::BigInt::new(Sign::Positive, []).to_unknown();
    let n1 = A::BigInt::new(Sign::Positive, [1]).to_unknown();
    assert_eq!(A::multiply(n1.clone(), n0.clone()).unwrap(), n0);
    assert_eq!(A::multiply(n0.clone(), n1.clone()).unwrap(), n0);

    let n_minus1 = A::BigInt::new(Sign::Negative, [1]).to_unknown();
    assert_eq!(A::multiply(n_minus1.clone(), n0.clone()).unwrap(), n0);
    assert_eq!(A::multiply(n0.clone(), n_minus1.clone()).unwrap(), n0);
    assert_eq!(A::multiply(n_minus1.clone(), n_minus1.clone()).unwrap(), n1);

    let a = A::BigInt::new(Sign::Positive, [1, 2, 3, 4]).to_unknown();
    let b = A::BigInt::new(Sign::Positive, [5, 6, 7]).to_unknown();
    let expected = A::BigInt::new(Sign::Positive, [5, 16, 34, 52, 45, 28]).to_unknown();
    assert_eq!(A::multiply(a.clone(), b.clone()).unwrap(), expected);
    assert_eq!(A::multiply(b.clone(), a.clone()).unwrap(), expected);

    let a = A::BigInt::new(Sign::Negative, [u64::MAX]).to_unknown();
    let expected = A::BigInt::new(Sign::Positive, [1, u64::MAX - 1]).to_unknown();
    assert_eq!(A::multiply(a.clone(), a.clone()).unwrap(), expected);

    let b = A::BigInt::new(Sign::Negative, [u64::MAX, u64::MAX, u64::MAX]).to_unknown();
    let expected =
        A::BigInt::new(Sign::Positive, [1, u64::MAX, u64::MAX, u64::MAX - 1]).to_unknown();
    assert_eq!(A::multiply(a.clone(), b.clone()).unwrap(), expected);
    assert_eq!(A::multiply(b.clone(), a.clone()).unwrap(), expected);
}

fn test_vm<A: Any>() {
    eq::<A>();
    unary_plus::<A>();
    unary_minus::<A>();
    multiply::<A>();
    big_int_mul::<A>();
}

#[test]
#[wasm_bindgen_test]
fn test() {
    test_vm::<naive::Any>();
}
