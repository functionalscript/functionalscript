//! Tests with no JavaScript counterpart.
//!
//! Operator behaviour is *not* tested here. It is described once, as data, in
//! `fjs/nanvm/module.f.mjs`, and reaches this crate as `generated.rs`
//! (see `nanvm-lib/tests/README.md`). What stays hand-written is everything
//! that has nothing to compare against in a JS engine: conversions out of
//! `Any`, `Debug` formatting, bigint limb arithmetic, and the
//! reference-identity guarantee `&&`/`||`/`??`/`?:` make — the shared corpus
//! can prove *which* operand a case selects but not that the selected
//! array/object/function comes back as the very same object, since it lowers
//! every operand to a node of its own and compares by value, not identity.

mod generated;
mod harness;

use nanvm_lib::{
    common::default::default,
    naive,
    sign::Sign,
    vm::{Any, Array, BigInt, Function, IContainer, IVm, Nullish, Object, String, ToAny},
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

/// Decimal display across limb and decimal-group boundaries.
fn bigint_display_format<A: IVm>() {
    let zero: BigInt<A> = 0u64.into();
    assert_eq!(zero.to_string(), "0");

    let two_to_64 = BigInt::<A>::normalize_new(Sign::Positive, [0, 1]);
    assert_eq!(two_to_64.to_string(), "18446744073709551616");

    let decimal_group_boundary =
        BigInt::<A>::normalize_new(Sign::Positive, [10_000_000_000_000_000_000]);
    assert_eq!(decimal_group_boundary.to_string(), "10000000000000000000");

    let max_u128 = BigInt::<A>::normalize_new(Sign::Positive, [u64::MAX, u64::MAX]);
    assert_eq!(
        max_u128.to_string(),
        "340282366920938463463374607431768211455"
    );

    let negative = BigInt::<A>::normalize_new(Sign::Negative, [0, 1]);
    assert_eq!(negative.to_string(), "-18446744073709551616");
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

/// The generated mixed-numeric cases assert only that they throw; this pins
/// the message owned by `nanvm-lib`.
fn mixed_numeric_operands_message<A: IVm>() {
    let number: Any<A> = 1.0.to_any();
    let bigint: Any<A> = BigInt::from(1u64).to_any();
    let expected =
        Err("TypeError: Cannot mix BigInt and other types, use explicit conversions".into());
    assert_eq!(number.clone() * bigint.clone(), expected);
    assert_eq!(number - bigint, expected);
}

fn bigint_add<A: IVm>() {
    let n0: Any<A> = BigInt::default().to_any();
    assert_eq!((n0.clone() + n0.clone()).unwrap(), n0);
    let n2: Any<A> = BigInt::from(2u64).to_any();
    let n4: Any<A> = BigInt::from(4u64).to_any();
    assert_eq!((n0.clone() + n2.clone()).unwrap(), n2);
    assert_eq!(
        (n2.clone() + n4.clone()).unwrap(),
        BigInt::from(6u64).to_any()
    );
}

/// Multi-limb subtraction, which the shared data cannot reach: its bigints
/// all fit in an `i64`.
fn bigint_sub<A: IVm>() {
    let minuend: Any<A> = BigInt::normalize_new(Sign::Positive, [0, 1, 1]).to_any();
    let subtrahend: Any<A> = BigInt::normalize_new(Sign::Positive, [1, 1]).to_any();
    let expected: Any<A> = BigInt::normalize_new(Sign::Positive, [u64::MAX, u64::MAX, 0]).to_any();
    assert_eq!((minuend.clone() - subtrahend.clone()).unwrap(), expected);
    let negative_expected: Any<A> =
        BigInt::normalize_new(Sign::Negative, [u64::MAX, u64::MAX, 0]).to_any();
    assert_eq!((subtrahend - minuend).unwrap(), negative_expected);
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

/// `&&`/`||`/`??`/`?:` select an operand rather than deriving a new value —
/// see the module doc comment for why the shared corpus cannot pin this.
/// `Array`/`Object`/`Function` equality is `ptr_eq` (their `partial_eq.rs`),
/// so comparing the result against the very `Any` handed in — not a fresh,
/// equal-content one — is what actually proves the selected operand comes
/// back unchanged rather than reconstructed.
fn reference_identity_selection<A: IVm>() {
    let array: Any<A> = Array::default().to_any();
    let object: Any<A> = Object::default().to_any();
    let function: Any<A> = Function::<A>(A::InternalFunction::new_ok(("".into(), 0), [0])).to_any();

    // `&&`: a reference-typed value is always truthy, so it can only ever be
    // the discarded left or the selected right — never returned via the
    // "falsy self" branch, which no reference type can take.
    assert_eq!(
        Any::logical_and(true.to_any(), array.clone()).unwrap(),
        array
    );

    // `||`: always-truthy on the left selects itself; on the right it is
    // selected whenever the left is falsy.
    assert_eq!(
        Any::logical_or(object.clone(), 0.0.to_any()).unwrap(),
        object
    );
    assert_eq!(
        Any::logical_or(false.to_any(), function.clone()).unwrap(),
        function
    );

    // `??`: never-nullish on the left selects itself; on the right it is
    // selected whenever the left is nullish.
    assert_eq!(
        Any::nullish_coalescing(array.clone(), 0.0.to_any()).unwrap(),
        array
    );
    assert_eq!(
        Any::nullish_coalescing(Nullish::Null.to_any(), object.clone()).unwrap(),
        object
    );

    // `?:`: both branches.
    assert_eq!(
        Any::conditional(true.to_any(), function.clone(), array.clone()).unwrap(),
        function
    );
    assert_eq!(
        Any::conditional(false.to_any(), array.clone(), object.clone()).unwrap(),
        object
    );
}

fn gen_test<A: IVm>() {
    generated::all::<A>();
    //
    conversions::<A>();
    debug_format::<A>();
    bigint_debug_format::<A>();
    bigint_display_format::<A>();
    unary_plus_bigint_message::<A>();
    mixed_numeric_operands_message::<A>();
    bigint_add::<A>();
    bigint_sub::<A>();
    bigint_mul::<A>();
    bigint_negative_zero::<A>();
    format_fn::<A>();
    reference_identity_selection::<A>();
}

#[test]
fn test() {
    gen_test::<naive::Naive>();
}
