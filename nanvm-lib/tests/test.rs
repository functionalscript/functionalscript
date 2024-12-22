use core::panic;

use nanvm_lib::{
    interface::{Any, Complex, Container, Extension, Utf8},
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
    // null
    let null0: A = Simple::Nullish(Nullish::Null).to_unknown();
    assert_eq!(null0.unary_plus(), Simple::Number(0.0).to_unknown());
    // undefined
    let undefined0: A = Simple::Nullish(Nullish::Undefined).to_unknown();
    let nan0 = undefined0.unary_plus();
    if let Some(simple) = nan0.try_to_simple() {
        match simple {
            Simple::Number(f) => {
                assert!(f.is_nan());
            }
            _ => panic!("expected Number result of unary_plus of undefined"),
        }
    } else {
        panic!("expected Simple result of unary_plus of undefined");
    }
    // boolean
    let true0: A = Simple::Boolean(true).to_unknown();
    assert_eq!(true0.unary_plus(), Simple::Number(1.0).to_unknown());
    let false0: A = Simple::Boolean(false).to_unknown();
    assert_eq!(false0.unary_plus(), Simple::Number(0.0).to_unknown());
    // number
    let number00: A = Simple::Number(0.0).to_unknown();
    assert_eq!(number00.unary_plus(), Simple::Number(0.0).to_unknown());
    let number01: A = Simple::Number(2.3).to_unknown();
    assert_eq!(number01.unary_plus(), Simple::Number(2.3).to_unknown());
    let number02: A = Simple::Number(-2.3).to_unknown();
    assert_eq!(number02.unary_plus(), Simple::Number(-2.3).to_unknown());
    // string
    let empty_string: A = "".to_unknown();
    assert_eq!(empty_string.unary_plus(), Simple::Number(0.0).to_unknown());
    let string0: A = "0".to_unknown();
    assert_eq!(string0.unary_plus(), Simple::Number(0.0).to_unknown());
    let string1: A = "2.3".to_unknown();
    assert_eq!(string1.unary_plus(), Simple::Number(2.3).to_unknown());
    let string2: A = "a".to_unknown();
    let nan1 = string2.unary_plus();
    if let Some(simple) = nan1.try_to_simple() {
        match simple {
            Simple::Number(f) => {
                assert!(f.is_nan());
            }
            _ => panic!("expected Number result of unary_plus of non-number string"),
        }
    } else {
        panic!("expected Simple result of unary_plus of non-number string");
    }
    // bigint
    let bigint0: A = A::BigInt::new(Sign::Positive, [0]).to_unknown();
    // TODO: catch TypeError here when the right error handling is implemented; NAN for now.
    let nan2 = bigint0.unary_plus();
    if let Some(simple) = nan2.try_to_simple() {
        match simple {
            Simple::Number(f) => {
                assert!(f.is_nan());
            }
            _ => panic!("expected Number result of unary_plus of bigint"),
        }
    } else {
        panic!("expected Simple result of unary_plus of non-number bigint");
    }
    // array
    let array0: A = [].to_array_unknown();
    assert_eq!(array0.unary_plus(), Simple::Number(0.0).to_unknown());
    let array1: A = [Simple::Number(2.3).to_unknown()].to_array_unknown();
    assert_eq!(array1.unary_plus(), Simple::Number(2.3).to_unknown());
    let string3: A = "-2.3".to_unknown();
    let array2: A = [string3].to_array_unknown();
    assert_eq!(array2.unary_plus(), Simple::Number(-2.3).to_unknown());
    let null1: A = Simple::Nullish(Nullish::Null).to_unknown();
    let array3: A = [null1.clone(), null1].to_array_unknown();
    let nan3 = array3.unary_plus();
    if let Some(simple) = nan3.try_to_simple() {
        match simple {
            Simple::Number(f) => {
                assert!(f.is_nan());
            }
            _ => panic!("expected Number result of unary_plus of multi-element array"),
        }
    } else {
        panic!("expected Simple result of unary_plus of multi-element array");
    }
    // object
    let object0: A = [].to_object_unknown();
    let nan4 = object0.unary_plus();
    if let Some(simple) = nan4.try_to_simple() {
        match simple {
            Simple::Number(f) => {
                assert!(f.is_nan());
            }
            _ => panic!("expected Number result of unary_plus of object"),
        }
    } else {
        panic!("expected Simple result of unary_plus of object");
    }
    // TODO: test objects with valueOf, toString functions.
    // TODO: test Function.
}

#[test]
fn naive_eq() {
    eq::<naive::Any>();
    unary_plus::<naive::Any>();
}
