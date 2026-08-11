//! Tests with no JavaScript counterpart.
//!
//! Operator behaviour is *not* tested here. It is described once, as data, in
//! `nanvm-lib/tests/module.f.mjs`, and reaches this crate as `generated.rs`
//! (see `nanvm-lib/tests/README.md`). What stays hand-written is everything
//! that has nothing to compare against in a JS engine: conversions out of
//! `Any`, `Debug` formatting, bigint limb arithmetic, and serialization.

mod generated;
mod harness;

use nanvm_lib::{
    common::{default::default, iter::Iter, serializable::Serializable},
    naive,
    sign::Sign,
    vm::{
        Any, Array, BigInt, Function, IContainer, IVm, Nullish, Object, Property, String, ToAny,
        ToArray, ToObject, Unpacked,
    },
};

/// `try_into` out of `Any`, for each type that supports it.
fn conversions<A: IVm>() {
    let n: Any<A> = Nullish::Null.to_any();
    let n: Nullish = n.try_into().unwrap();
    assert_eq!(n, Nullish::Null);

    let t: Any<A> = true.to_any();
    let t: bool = t.try_into().unwrap();
    assert!(t);

    let s: Any<A> = "Hello".into();
    let s: String<A> = s.try_into().unwrap();
    assert_eq!(s, String::from("Hello"));

    let nan: Any<A> = f64::NAN.to_any();
    let nan: f64 = nan.try_into().unwrap();
    assert!(nan.is_nan());

    let nz: Any<A> = (-0.0).to_any();
    let nz: f64 = nz.try_into().unwrap();
    assert_eq!(format!("{nz}"), "-0");
    assert_eq!(1.0 / nz, -f64::INFINITY);

    // The generated tests compare numbers with `Object.is` semantics, which
    // `harness::same` implements with `to_bits`; this is the property that
    // makes that work.
    assert_eq!((-0f64).to_bits(), (-0f64).to_bits());
    assert_ne!(0f64.to_bits(), (-0f64).to_bits());
}

fn debug_format<A: IVm>() {
    let s: Any<A> = "Hello".into();
    let s: String<A> = s.try_into().unwrap();
    assert_eq!(format!("{s:?}"), "\"Hello\"");

    let o: Any<A> = Object::default().to_any();
    let o: Object<A> = o.try_into().unwrap();
    assert_eq!(format!("{o:?}"), "{}");

    let a: Any<A> = Array::default().to_any();
    let a: Array<A> = a.try_into().unwrap();
    assert_eq!(format!("{a:?}"), "[]");

    let b: Any<A> = BigInt::default().to_any();
    let b: BigInt<A> = b.try_into().unwrap();
    assert_eq!(b, default());
    assert_eq!(format!("{b:?}"), "0n");
}

/// `Debug` for bigints at the edges of the one-limb range.
fn bigint_debug_format<A: IVm>() {
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

/// Structural equality, which `==` on `Any` deliberately is not: containers
/// compare by reference there, so a round-tripped value never equals its
/// original.
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

    for value in values.iter() {
        let mut buf = Vec::new();
        value.clone().serialize(&mut buf).unwrap();
        let mut cursor = Cursor::new(buf);
        let result = Any::deserialize(&mut cursor).unwrap();
        assert!(eq_value(value, &result));
    }
}

fn format_fn<A: IVm>() {
    let f = Function::<A>(A::InternalFunction::new_ok(
        ("myfunc".into(), 2),
        [0xDE, 0xAD, 0xBE, 0xEF],
    ));
    let x = format!("{f:?}");
    assert_eq!(x, "function myfunc(a0,a1) {DEADBEEF}");
}

/// The generated `unary_plus` case only asserts *that* `+0n` throws; the
/// message is `nanvm-lib`'s own, so it is pinned here.
fn unary_plus_bigint_message<A: IVm>() {
    let b: Any<A> = BigInt::default().to_any();
    assert_eq!(
        Any::unary_plus(b),
        Err("TypeError: Cannot convert a BigInt value to a number".into())
    );
}

fn bigint_add<A: IVm>() {
    let n0: Any<A> = BigInt::default().to_any();
    assert_eq!((n0.clone() + n0.clone()), n0);
    let n2: Any<A> = BigInt::from(2u64).to_any();
    let n4: Any<A> = BigInt::from(4u64).to_any();
    assert_eq!((n0.clone() + n2.clone()), n2);
    assert_eq!((n2.clone() + n4.clone()), BigInt::from(6u64).to_any());
}

/// Multi-limb multiplication, which the shared data cannot reach: its bigints
/// all fit in an `i64`.
fn bigint_mul<A: IVm>() {
    let n0: Any<A> = BigInt::default().to_any();
    let n1: Any<A> = BigInt::from(1u64).to_any();
    assert_eq!((n1.clone() * n0.clone()).unwrap(), n0);
    assert_eq!((n0.clone() * n1.clone()).unwrap(), n0);

    let n_minus1: Any<A> = BigInt::from(-1i64).to_any();
    assert_eq!((n_minus1.clone() * n0.clone()).unwrap(), n0);
    assert_eq!((n0.clone() * n_minus1.clone()).unwrap(), n0);
    assert_eq!((n_minus1.clone() * n_minus1.clone()).unwrap(), n1);

    let a: Any<A> = BigInt::normalize_new(Sign::Positive, [1, 2, 3, 4]).to_any();
    let b: Any<A> = BigInt::normalize_new(Sign::Positive, [5, 6, 7]).to_any();
    let expected: Any<A> = BigInt::normalize_new(Sign::Positive, [5, 16, 34, 52, 45, 28]).to_any();
    assert_eq!((a.clone() * b.clone()).unwrap(), expected);
    assert_eq!((b.clone() * a.clone()).unwrap(), expected);

    let a: Any<A> = BigInt::normalize_new(Sign::Negative, [u64::MAX]).to_any();
    let expected: Any<A> = BigInt::normalize_new(Sign::Positive, [1, u64::MAX - 1]).to_any();
    assert_eq!((a.clone() * a.clone()).unwrap(), expected);

    let b: Any<A> = BigInt::normalize_new(Sign::Negative, [u64::MAX, u64::MAX, u64::MAX]).to_any();
    let expected: Any<A> =
        BigInt::normalize_new(Sign::Positive, [1, u64::MAX, u64::MAX, u64::MAX - 1]).to_any();
    assert_eq!((a.clone() * b.clone()).unwrap(), expected);
    assert_eq!((b.clone() * a.clone()).unwrap(), expected);
}

/// A `nanvm-lib` normalization invariant: there is no negative zero bigint.
fn bigint_negative_zero<A: IVm>() {
    let mn0: BigInt<A> = BigInt::normalize_new(Sign::Negative, []);
    let n0: BigInt<A> = BigInt::default();
    assert_eq!(mn0, n0);
}

fn gen_test<A: IVm>() {
    generated::all::<A>();
    //
    conversions::<A>();
    debug_format::<A>();
    bigint_debug_format::<A>();
    serialization::<A>();
    unary_plus_bigint_message::<A>();
    bigint_add::<A>();
    bigint_mul::<A>();
    bigint_negative_zero::<A>();
    format_fn::<A>();
}

#[test]
fn test() {
    gen_test::<naive::Naive>();
}
