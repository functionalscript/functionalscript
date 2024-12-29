use core::panic;

use nanvm_lib::{
    interface::{Any, Complex, Container, Extension, RuntimeError, Utf8},
    naive,
    nullish::Nullish,
    sign::Sign,
    simple::Simple,
};

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

fn unary_plus<A: Any>() {
    let assert_is_nan = |a: A, test_case: &str| {
        let nan = Any::unary_plus(a).unwrap();
        if let Some(simple) = nan.try_to_simple() {
            match simple {
                Simple::Number(f) => {
                    assert!(f.is_nan());
                }
                _ => panic!("expected Number result of unary_plus of {}", test_case),
            }
        } else {
            panic!("expected Simple result of unary_plus of {}", test_case);
        }
    };

    // null
    let null0: A = Simple::Nullish(Nullish::Null).to_unknown();
    assert_eq!(
        Any::unary_plus(null0).unwrap(),
        Simple::Number(0.0).to_unknown()
    );

    // undefined
    let undefined0: A = Simple::Nullish(Nullish::Undefined).to_unknown();
    assert_is_nan(Any::unary_plus(undefined0).unwrap(), "undefined");

    // boolean
    let true0: A = Simple::Boolean(true).to_unknown();
    assert_eq!(
        Any::unary_plus(true0).unwrap(),
        Simple::Number(1.0).to_unknown()
    );
    let false0: A = Simple::Boolean(false).to_unknown();
    assert_eq!(
        Any::unary_plus(false0).unwrap(),
        Simple::Number(0.0).to_unknown()
    );

    // number
    let number00: A = Simple::Number(0.0).to_unknown();
    assert_eq!(
        Any::unary_plus(number00).unwrap(),
        Simple::Number(0.0).to_unknown()
    );
    let number01: A = Simple::Number(2.3).to_unknown();
    assert_eq!(
        Any::unary_plus(number01).unwrap(),
        Simple::Number(2.3).to_unknown()
    );
    let number02: A = Simple::Number(-2.3).to_unknown();
    assert_eq!(
        Any::unary_plus(number02).unwrap(),
        Simple::Number(-2.3).to_unknown()
    );

    // string
    let string_empty: A = "".to_unknown();
    assert_eq!(
        Any::unary_plus(string_empty).unwrap(),
        Simple::Number(0.0).to_unknown()
    );
    let string0: A = "0".to_unknown();
    assert_eq!(
        Any::unary_plus(string0).unwrap(),
        Simple::Number(0.0).to_unknown()
    );
    let string1: A = "2.3".to_unknown();
    assert_eq!(
        Any::unary_plus(string1).unwrap(),
        Simple::Number(2.3).to_unknown()
    );
    let string2: A = "a".to_unknown();
    assert_is_nan(Any::unary_plus(string2).unwrap(), "non-number string");

    // bigint
    let bigint0: A = A::BigInt::new(Sign::Positive, [0]).to_unknown();
    match Any::unary_plus(bigint0) {
        Err(RuntimeError::TypeError(s)) => {
            assert_eq!(s, "Cannot convert a BigInt value to a number");
        }
        _ => {
            panic!("expected TypeError");
        }
    }

    // array
    let array0: A = [].to_array_unknown();
    assert_eq!(
        Any::unary_plus(array0).unwrap(),
        Simple::Number(0.0).to_unknown()
    );
    let array1: A = [Simple::Number(2.3).to_unknown()].to_array_unknown();
    assert_eq!(
        Any::unary_plus(array1).unwrap(),
        Simple::Number(2.3).to_unknown()
    );
    let string3: A = "-2.3".to_unknown();
    let array2: A = [string3].to_array_unknown();
    assert_eq!(
        Any::unary_plus(array2).unwrap(),
        Simple::Number(-2.3).to_unknown()
    );
    let null1: A = Simple::Nullish(Nullish::Null).to_unknown();
    let array3: A = [null1.clone(), null1].to_array_unknown();
    assert_is_nan(Any::unary_plus(array3).unwrap(), "multi-element array");

    // object
    let object0: A = [].to_object_unknown();
    assert_is_nan(Any::unary_plus(object0).unwrap(), "object");
    // TODO: test objects with valueOf, toString functions.

    // function
    let function0: A = A::Function::new(0, [0]).to_unknown();
    assert_is_nan(Any::unary_plus(function0).unwrap(), "function");
}

#[test]
fn naive_eq() {
    eq::<naive::Any>();
    unary_plus::<naive::Any>();
}
