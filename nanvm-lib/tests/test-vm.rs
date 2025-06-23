use std::i64;

use nanvm_lib::{
    nullish::Nullish,
    vm::{naive, Any, Array, BigInt, IInternalAny, Object, String, ToAnyEx},
};

fn nullish_eq<A: IInternalAny>() {
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

fn bool_eq<A: IInternalAny>() {
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

fn number_eq<A: IInternalAny>() {
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
}

fn string_eq<A: IInternalAny>() {
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

fn object_eq<A: IInternalAny>() {
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

fn array_eq<A: IInternalAny>() {
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

fn bigint_eq<A: IInternalAny>() {
    let b0: Any<A> = BigInt::default().to_any();
    let b1 = BigInt::default().to_any();
    assert_eq!(b0, b1);
    let z: BigInt<_> = b0.try_into().unwrap();
    assert_eq!(z, BigInt::default());
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
        //               0123456789ABCDEF
        assert_eq!(x, "0n");
    }

    {
        let bm: BigInt<A> = 0i64.into();
        let x = format!("{bm:?}");
        //               0123456789ABCDEF
        assert_eq!(x, "0n");
    }
}

fn gen_test<A: IInternalAny>() {
    nullish_eq::<A>();
    bool_eq::<A>();
    number_eq::<A>();
    string_eq::<A>();
    object_eq::<A>();
    array_eq::<A>();
    bigint_eq::<A>();
}

#[test]
fn test() {
    gen_test::<naive::InternalAny>();
}
