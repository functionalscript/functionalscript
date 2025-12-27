use nanvm_lib::{
    common::{default::default, iter::Iter, serializable::Serializable},
    nullish::Nullish,
    vm::{
        naive, Any, Array, BigInt, Function, IContainer, IVm, Object, Property, String, ToAny,
        ToArray, ToObject, Unpacked,
    },
};

fn nullish_eq<A: IVm>() {
    let n0: Any<A> = Nullish::Null.to_any();
    let n1 = Nullish::Null.to_any();
    assert_eq!(n0, n1);
    let u0 = Nullish::Undefined.to_any();
    let u1 = Nullish::Undefined.to_any();
    assert_eq!(u0, u1);
    assert_ne!(n0, u0);

    let x: Nullish = n0.try_into().unwrap();
    assert_eq!(x, Nullish::Null);
}

fn bool_eq<A: IVm>() {
    let t0: Any<A> = true.to_any();
    let t1 = true.to_any();
    assert_eq!(t0, t1);
    let f0 = false.to_any();
    let f1 = false.to_any();
    assert_eq!(f0, f1);
    assert_ne!(t0, f0);

    let x: bool = t0.try_into().unwrap();
    assert!(x);
}

fn number_eq<A: IVm>() {
    // 0.5
    let a0: Any<A> = 0.5.to_any();
    let a1 = 0.5.to_any();
    assert_eq!(a0, a1);

    // 3.0
    let b0 = 3.0.to_any();
    let b1 = 3.0.to_any();
    assert_eq!(b0, b1);
    assert_ne!(a0, b0);

    // 0.0 and -0.0
    let pz = 0.0.to_any();
    let nz = (-0.0).to_any();
    assert_eq!(pz, nz);
    assert_ne!(a0, pz);

    let nzf: f64 = nz.try_into().unwrap();
    let nzs = format!("{nzf}");
    assert_eq!(nzs, "-0");
    let x = 1.0 / nzf;
    assert_ne!(x, f64::INFINITY);
    assert_eq!(x, -f64::INFINITY);

    // Infinity
    let i0 = f64::INFINITY.to_any();
    let i1 = f64::INFINITY.to_any();
    assert_eq!(i0, i1);
    assert_ne!(a0, i0);

    // -Infinity
    let ni0 = f64::NEG_INFINITY.to_any();
    let ni1 = f64::NEG_INFINITY.to_any();
    assert_eq!(ni0, ni1);
    assert_ne!(i0, ni0);
    let ni = x.to_any();
    assert_eq!(ni, ni0);

    // NaN
    let nan0 = f64::NAN.to_any();
    let nan1 = f64::NAN.to_any();
    assert_ne!(nan0, nan1);
    assert_ne!(i0, nan0);
    let nan0n: f64 = nan0.try_into().unwrap();
    assert!(nan0n.is_nan());
    let nan1n: f64 = nan1.try_into().unwrap();
    assert!(nan1n.is_nan());
}

fn string_eq<A: IVm>() {
    let s0: Any<A> = "Hello".into();
    let s1 = "Hello".into();
    assert_eq!(s0, s1);
    let s2 = "World".into();
    assert_ne!(s0, s2);

    let s: String<A> = s0.try_into().unwrap();
    assert_eq!(s, String::from("Hello"));

    let x = format!("{s:?}");
    assert_eq!(x, "\"Hello\"");
}

fn object_eq<A: IVm>() {
    let e0: Any<A> = Object::default().to_any();
    let e1 = Object::default().to_any();
    assert_eq!(e0, e0);
    assert_ne!(e0, e1);

    let o0: Object<A> = e0.try_into().unwrap();
    let o1: Object<A> = e1.try_into().unwrap();
    assert_eq!(o0, o0);
    assert_ne!(o0, o1);

    let x = format!("{o0:?}");
    assert_eq!(x, "{}");
}

fn array_eq<A: IVm>() {
    let e0: Any<A> = Array::default().to_any();
    let e1 = Array::default().to_any();
    assert_eq!(e0, e0);
    assert_ne!(e0, e1);

    let a0: Array<A> = e0.try_into().unwrap();
    let a1: Array<A> = e1.try_into().unwrap();
    assert_eq!(a0, a0);
    assert_ne!(a0, a1);

    let x = format!("{a0:?}");
    assert_eq!(x, "[]");
}

fn bigint_eq<A: IVm>() {
    let b0: Any<A> = BigInt::default().to_any();
    let b1 = BigInt::default().to_any();
    assert_eq!(b0, b1);
    let z: BigInt<_> = b0.try_into().unwrap();
    assert_eq!(z, default());
    let x = format!("{z:?}");
    assert_eq!(x, "0n");

    {
        let bm: BigInt<A> = i64::MIN.into();
        let x = format!("{bm:?}");
        //                0123456789ABCDEF
        assert_eq!(x, "-0x8000000000000000n");
        let i: i64 = i64::MIN;
        let m = i.overflowing_neg().0 as u64;
        assert_eq!(m, 0x8000000000000000);
    }

    {
        let bm: BigInt<A> = (i64::MIN + 1).into();
        let x = format!("{bm:?}");
        //                0123456789ABCDEF
        assert_eq!(x, "-0x7FFFFFFFFFFFFFFFn");
        let i: i64 = i64::MIN + 1;
        let m = i.overflowing_neg().0 as u64;
        assert_eq!(m, 0x7FFFFFFFFFFFFFFF);
    }

    {
        let bm: BigInt<A> = i64::MAX.into();
        let x = format!("{bm:?}");
        //               0123456789ABCDEF
        assert_eq!(x, "0x7FFFFFFFFFFFFFFFn");
    }

    {
        let bm: BigInt<A> = u64::MAX.into();
        let x = format!("{bm:?}");
        //               0123456789ABCDEF
        assert_eq!(x, "0xFFFFFFFFFFFFFFFFn");
    }

    {
        let bm: BigInt<A> = 0u64.into();
        let x = format!("{bm:?}");
        assert_eq!(x, "0n");
    }

    {
        let bm: BigInt<A> = 0i64.into();
        let x = format!("{bm:?}");
        assert_eq!(x, "0n");
    }
}

fn eq_container<T: IntoIterator>(a: T, b: T, e: fn(a: &T::Item, &T::Item) -> bool) -> bool {
    a.into_iter().eq_by_(b.into_iter(), e)
}

fn eq_value<A: IVm>(a: &Any<A>, b: &Any<A>) -> bool {
    match (a.clone().into(), b.clone().into()) {
        (Unpacked::Nullish(a), Unpacked::Nullish(b)) => a == b,
        (Unpacked::Boolean(a), Unpacked::Boolean(b)) => a == b,
        (Unpacked::Number(a), Unpacked::Number(b)) => a.to_bits() == b.to_bits(),
        (Unpacked::String(a), Unpacked::String(b)) => a == b,
        (Unpacked::BigInt(a), Unpacked::BigInt(b)) => a == b,
        (Unpacked::Array(a), Unpacked::Array(b)) => eq_container(a, b, eq_value),
        (Unpacked::Object(a), Unpacked::Object(b)) => {
            eq_container(a, b, |x: &Property<A>, y: &Property<A>| {
                x.0 == y.0 && eq_value(&x.1, &y.1)
            })
        }
        _ => false,
    }
}

// We keep old_eq here despite the fact that it's mostly redundant (most likely). At a better moment
// we will revisit this test and remove redundant cases here.
fn old_eq<A: IVm>() {
    // nullish
    let null0: Any<A> = Nullish::Null.to_any();
    let null1 = Nullish::Null.to_any();
    let undefined0 = Nullish::Undefined.to_any();
    let undefined1 = Nullish::Undefined.to_any();
    {
        assert_eq!(null0, null1);
        assert_eq!(undefined0, undefined1);
        assert_ne!(null1, undefined0);
    }
    // boolean
    let true0: Any<A> = true.to_any();
    let true1 = true.to_any();
    let false0 = false.to_any();
    let false1 = false.to_any();
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
    let number00: Any<A> = 2.3.to_any();
    let number01 = 2.3.to_any();
    let number1 = (-5.4).to_any();
    let number_nan = f64::NAN.to_any();
    let number_p0 = 0.0.to_any();
    let number_n0 = (-0.0).to_any();
    let number_p_inf0: Any<A> = f64::INFINITY.to_any();
    let number_p_inf1 = f64::INFINITY.to_any();
    let number_n_inf0 = (-f64::INFINITY).to_any();
    let number_n_inf1 = (-f64::INFINITY).to_any();
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
    let string_hello0: Any<A> = "Hello!".into();
    let string_hello1 = "Hello!".into();
    let string_world0 = "world!".into();
    let string0: Any<A> = "0".into();
    let s0: String<A> = "0".into();
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
    let bigint12_0: Any<A> = Into::<BigInt<A>>::into(12u64).to_any();
    let bigint12_1 = Into::<BigInt<_>>::into(12u64).to_any();
    let bigint12m = Into::<BigInt<_>>::into(-12i64).to_any();
    let bigint13 = Into::<BigInt<_>>::into(13u64).to_any();
    {
        assert_eq!(bigint12_0, bigint12_1);
        assert_ne!(bigint12_0, bigint12m);
        assert_ne!(bigint12_0, bigint13);
    }
    // array
    let array0: Any<A> = Array::default().to_any();
    let array1 = Array::default().to_any();
    let array2: Any<A> = [string0.clone()].to_array().to_any();
    {
        assert_eq!(array0, array0);
        assert_ne!(array0, array1);
        assert_eq!(array2, array2);
    }
    // object
    let object0: Any<A> = [(s0.clone(), string0.clone())].to_object().to_any();
    let object1 = [(s0, string0)].to_object().to_any();
    {
        assert_eq!(object0, object0);
        assert_ne!(object0, object1);
    }
}

fn serialization<A: IVm>() {
    use std::io::Cursor;

    let values: &[Any<A>] = &[
        Nullish::Null.to_any(),
        Nullish::Undefined.to_any(),
        true.to_any(),
        false.to_any(),
        2.3.to_any(),
        "Hello".into(),
        Into::<BigInt<A>>::into(12u64).to_any(),
        Array::default().to_any(),
        [7.0.to_any()].to_array().to_any(),
        [("a".into(), 1.0.to_any()), ("b".into(), "c".into())]
            .to_object()
            .to_any(),
    ];

    for value in values.into_iter() {
        let mut buf = Vec::new();
        value.clone().serialize(&mut buf).unwrap();
        let mut cursor = Cursor::new(buf);
        let result = Any::deserialize(&mut cursor).unwrap();
        assert!(eq_value(&value, &result));
    }
}

fn number_coerce_to_string<A: IVm>() {
    let n: Any<A> = 123.0.to_any();
    assert_eq!(n.to_string(), Ok("123".into()));

    let n: Any<A> = (-456.0).to_any();
    assert_eq!(n.to_string(), Ok("-456".into()));

    let n: Any<A> = (0.0).to_any();
    assert_eq!(n.to_string(), Ok("0".into()));

    let n: Any<A> = (-0.0).to_any();
    assert_eq!(n.to_string(), Ok("0".into()));

    let n: Any<A> = (1.0 / -0.0).to_any();
    assert_eq!(n.to_string(), Ok("-Infinity".into()));

    let n: Any<A> = f64::INFINITY.to_any();
    assert_eq!(n.to_string(), Ok("Infinity".into()));

    let n: Any<A> = f64::NEG_INFINITY.to_any();
    assert_eq!(n.to_string(), Ok("-Infinity".into()));

    let n: Any<A> = f64::NAN.to_any();
    assert_eq!(n.to_string(), Ok("NaN".into()));
}

fn array_coerce_to_string<A: IVm>() {
    let a: Any<A> = [].to_array().to_any();
    assert_eq!(a.to_string(), Ok("".into()));

    let a: Any<A> = [1.0.to_any()].to_array().to_any();
    assert_eq!(a.to_string(), Ok("1".into()));

    let a: Any<A> = [1.0.to_any(), 2.0.to_any(), 3.0.to_any()]
        .to_array()
        .to_any();
    assert_eq!(a.to_string(), Ok("1,2,3".into()));

    let a: Any<A> = [
        1.0.to_any(),
        [2.0.to_any(), 3.0.to_any()].to_array().to_any(),
        4.0.to_any(),
    ]
    .to_array()
    .to_any();
    assert_eq!(a.to_string(), Ok("1,2,3,4".into()));
}

fn format_fn<A: IVm>() {
    let f = Function::<A>(A::InternalFunction::new_ok(
        ("myfunc".into(), 2),
        [0xDE, 0xAD, 0xBE, 0xEF],
    ));
    let x = format!("{f:?}");
    assert_eq!(x, "function myfunc(a0,a1) {DEADBEEF}");
}

fn gen_test<A: IVm>() {
    nullish_eq::<A>();
    bool_eq::<A>();
    number_eq::<A>();
    string_eq::<A>();
    object_eq::<A>();
    array_eq::<A>();
    bigint_eq::<A>();
    old_eq::<naive::Naive>();
    serialization::<A>();
    number_coerce_to_string::<A>();
    array_coerce_to_string::<A>();
    //
    format_fn::<A>();
}

#[test]
fn test() {
    gen_test::<naive::Naive>();
}
