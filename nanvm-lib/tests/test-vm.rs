use nanvm_lib::{
    nullish::Nullish,
    vm::{naive, Any, String, IInternalAny, ToAnyEx},
};

fn gen_test<A: IInternalAny>() {
    let x: Any<A> = 0.5.to_any();
    assert_eq!(x, x);

    let s: Any<A> = "Hello".into();
    assert_eq!(s, s);

    let z: Any<A> = true.to_any();
    assert_eq!(z, z);

    let w: Any<A> = Nullish::Null.to_any();
    assert_eq!(w, w);

    let n: f64 = x.try_into().unwrap();
    assert_eq!(n, 0.5);
    let _: String<A> = s.try_into().unwrap();
    let m: bool = z.try_into().unwrap();
    assert_eq!(m, true);
}

#[test]
fn test() {
    gen_test::<naive::InternalAny>();
}
