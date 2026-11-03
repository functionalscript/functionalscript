//! The FunctionalScript view's proofs of L0, on NaNVM: every function, and
//! every misuse that traps in WASM, which panics here with the text the
//! view throws.

use super::*;
use crate::naive::Naive;

type A = Naive;
type V = Any<A>;

fn s(x: &str) -> V {
    x.into()
}

fn n(x: f64) -> V {
    from_f64(x)
}

fn units(x: &str) -> Vec<u16> {
    x.encode_utf16().collect()
}

fn array(items: impl IntoIterator<Item = V>) -> V {
    let items: Vec<V> = items.into_iter().collect();
    let mut b = begin_array(items.len() as u32);
    for v in items {
        b.push(v);
    }
    b.seal()
}

fn object<'a>(properties: impl IntoIterator<Item = (&'a str, V)>) -> V {
    let properties: Vec<(&str, V)> = properties.into_iter().collect();
    let mut b = begin_object(properties.len() as u32);
    for (k, v) in properties {
        b.push_property(s(k), v);
    }
    b.seal()
}

/// `(a, b) => [a, b]`.
fn pair(_: &<A as IVm>::InternalFunction, args: Array<A>) -> Result<V, V> {
    Ok(args.to_any())
}

fn f2() -> V {
    make_function(pair, array([]), 2, Some("(a, b) => [a, b]"))
}

/// One value of each kind, in tag order.
fn values() -> [V; 9] {
    [
        undefined(),
        null(),
        from_bool(true),
        n(1.5),
        s("ab"),
        make_bigint(1, &[7]),
        array([n(1.0)]),
        object([("a", n(1.0))]),
        f2(),
    ]
}

#[test]
fn tags() {
    let tags = [
        Kind::Undefined,
        Kind::Null,
        Kind::Boolean,
        Kind::Number,
        Kind::String,
        Kind::BigInt,
        Kind::Array,
        Kind::Object,
        Kind::Function,
    ];
    for (i, t) in tags.into_iter().enumerate() {
        assert_eq!(t as usize, i);
    }
}

#[test]
fn kinds() {
    for (i, v) in values().iter().enumerate() {
        assert_eq!(kind(v) as usize, i);
    }
    assert_eq!(kind(&from_bool::<A>(false)), Kind::Boolean);
    assert_eq!(kind(&n(f64::NAN)), Kind::Number);
    assert_eq!(kind(&s("")), Kind::String);
    assert_eq!(kind(&make_bigint::<A>(0, &[])), Kind::BigInt);
    assert_eq!(kind(&array([])), Kind::Array);
    assert_eq!(kind(&object([])), Kind::Object);
}

#[test]
fn scalars() {
    assert_eq!(to_f64(&n(1.5)), 1.5);
    assert!(to_f64(&n(-f64::NAN)).is_nan());
    assert_eq!(to_f64(&n(-0.0)).to_bits(), (-0.0f64).to_bits());
    assert!(to_bool(&from_bool::<A>(true)));
    assert!(!to_bool(&from_bool::<A>(false)));
}

#[test]
fn lengths() {
    assert_eq!(length(&s("")), 0);
    assert_eq!(length(&s("\u{1F600}")), 2);
    assert_eq!(length(&make_bigint::<A>(0, &[])), 0);
    assert_eq!(length(&make_bigint::<A>(1, &[1])), 1);
    assert_eq!(length(&make_bigint::<A>(-1, &[1])), 1);
    assert_eq!(length(&make_bigint::<A>(1, &[u64::MAX])), 1);
    assert_eq!(length(&make_bigint::<A>(1, &[0, 1])), 2);
    assert_eq!(length(&make_bigint::<A>(-1, &[0, 1])), 2);
    assert_eq!(length(&array([])), 0);
    assert_eq!(length(&array([n(1.0), n(2.0), n(3.0)])), 3);
    assert_eq!(length(&object([])), 0);
    assert_eq!(length(&object([("a", n(1.0)), ("b", n(2.0))])), 2);
    assert_eq!(length(&f2()), 2);
    assert_eq!(length(&make_function(pair, array([]), 0, None)), 0);
}

#[test]
fn items() {
    assert_eq!(item(&array([s("a"), s("b")]), 1), s("b"));
    assert_eq!(item(&array([s("a"), s("b")]), 0), s("a"));
    assert_eq!(item(&object([("x", s("a")), ("y", s("b"))]), 1), s("b"));
}

#[test]
fn keys() {
    let o = object([("y", n(1.0)), ("x", n(2.0)), ("", n(3.0))]);
    assert_eq!(key(&o, 0), s("y"));
    assert_eq!(key(&o, 1), s("x"));
    assert_eq!(key(&o, 2), s(""));
    assert_eq!(find(&o, &s("y")), 0);
    assert_eq!(find(&o, &s("x")), 1);
    assert_eq!(find(&o, &s("")), 2);
    assert_eq!(find(&o, &s("z")), -1);
    assert_eq!(find(&object([]), &s("z")), -1);
}

/// A repeated key keeps its first position and its last value, and an
/// array-index key comes first, as `Object.entries` lists them.
#[test]
fn seal_merges_keys() {
    let o = object([("b", n(1.0)), ("a", n(2.0)), ("b", n(3.0)), ("1", n(4.0))]);
    assert_eq!(length(&o), 3);
    assert_eq!(key(&o, 0), s("1"));
    assert_eq!(key(&o, 1), s("b"));
    assert_eq!(item(&o, 1), n(3.0));
    assert_eq!(key(&o, 2), s("a"));
}

/// An object NaNVM built itself, with a repeated key, reads the same way.
#[test]
fn native_object() {
    let o: V = [(String::from("a"), n(1.0)), (String::from("a"), n(2.0))]
        .to_object()
        .to_any();
    assert_eq!(length(&o), 1);
    assert_eq!(item(&o, 0), n(2.0));
}

#[test]
fn identity() {
    let a = array([n(1.0)]);
    let o = object([("a", a.clone())]);
    let f = f2();
    assert!(same(&a, &a));
    assert!(same(&o, &o));
    assert!(same(&f, &f));
    assert!(!same(&a, &array([n(1.0)])));
    assert!(!same(&o, &object([("a", a.clone())])));
    assert!(!same(&a, &o));
    assert!(!same(&f, &f2()));
}

#[test]
fn functions() {
    let f = f2();
    assert_eq!(text(&f), s("(a, b) => [a, b]"));
    assert_eq!(text(&make_function(pair, array([]), 0, None)), undefined());
    let args = array([n(1.0), n(2.0)]);
    let r = call(&f, &args).unwrap();
    assert!(same(&r, &args));
}

#[test]
fn frames() {
    fn first(self_: &<A as IVm>::InternalFunction, _: Array<A>) -> Result<V, V> {
        Ok(frame(self_, 0))
    }
    let f = make_function(first, array([s("x")]), 0, None);
    assert_eq!(call(&f, &array([])).unwrap(), s("x"));
}

#[test]
fn strings() {
    assert_eq!(unit(&s("abc"), 1), 0x62);
    assert_eq!(unit(&s("\u{1F600}"), 0), 0xd83d);
    assert_eq!(unit(&s("\u{1F600}"), 1), 0xde00);
    assert_eq!(from_unit::<A>(0x61), s("a"));
    assert_eq!(from_unit::<A>(0), s("\u{0}"));
    assert_eq!(from_unit::<A>(0xffff), s("\u{ffff}"));
    assert_eq!(
        concat(&from_unit::<A>(0xd83d), &from_unit(0xde00)),
        s("\u{1F600}")
    );
    assert_eq!(concat(&s("ab"), &s("cd")), s("abcd"));
    assert_eq!(concat(&s(""), &s("")), s(""));
    assert_eq!(substring(&s("abcdef"), 1, 3), s("bc"));
    assert_eq!(substring(&s("abcdef"), 0, 6), s("abcdef"));
    assert_eq!(substring(&s("abcdef"), 6, 6), s(""));
    assert_eq!(substring(&s(""), 0, 0), s(""));
}

#[test]
fn joins() {
    assert_eq!(join(&array([]), &s(",")), s(""));
    assert_eq!(join(&array([s("a")]), &s(",")), s("a"));
    assert_eq!(join(&array([s("a"), s(""), s("b")]), &s(", ")), s("a, , b"));
}

#[test]
fn bytes() {
    let x = make_string::<A>(&units("h\u{e9}\u{1F600}"));
    assert_eq!(x, s("h\u{e9}\u{1F600}"));
    let mut out = [0u16; 3];
    read_units(&x, 1, &mut out);
    assert_eq!(out, [0xe9, 0xd83d, 0xde00]);
    read_units(&x, 4, &mut []);

    let b = make_bigint::<A>(-1, &[5, 7]);
    assert_eq!(sign(&b), -1);
    assert_eq!(sign(&make_bigint::<A>(0, &[])), 0);
    assert_eq!(sign(&make_bigint::<A>(1, &[1])), 1);
    let mut words = [0u64; 2];
    read_words(&b, 0, &mut words);
    assert_eq!(words, [5, 7]);
    let minus_seven: V = BigInt::<A>::normalize_new(Sign::Negative, [7]).to_any();
    assert_eq!(make_bigint::<A>(-1, &[7]), minus_seven);
}

/// Each misuse that traps in WASM, by the text it panics with.
mod traps {
    use super::*;

    #[test]
    #[should_panic(expected = "l0.to_f64: not a number")]
    fn to_f64_string() {
        to_f64(&s("1"));
    }

    #[test]
    #[should_panic(expected = "l0.to_bool: not a boolean")]
    fn to_bool_number() {
        to_bool(&n(1.0));
    }

    #[test]
    #[should_panic(expected = "l0.length: not a string")]
    fn length_undefined() {
        length(&undefined::<A>());
    }

    #[test]
    #[should_panic(expected = "l0.length: not a string")]
    fn length_null() {
        length(&null::<A>());
    }

    #[test]
    #[should_panic(expected = "l0.length: not a string")]
    fn length_boolean() {
        length(&from_bool::<A>(true));
    }

    #[test]
    #[should_panic(expected = "l0.length: not a string")]
    fn length_number() {
        length(&n(0.0));
    }

    #[test]
    #[should_panic(expected = "l0.item: not an array or an object")]
    fn item_string() {
        item(&s("ab"), 0);
    }

    #[test]
    #[should_panic(expected = "l0.item: not an array or an object")]
    fn item_function() {
        item(&f2(), 0);
    }

    #[test]
    #[should_panic(expected = "l0.item: not an index")]
    fn item_past() {
        item(&array([n(1.0)]), 1);
    }

    #[test]
    #[should_panic(expected = "l0.item: not an index")]
    fn item_object_past() {
        item(&object([("a", n(1.0))]), 1);
    }

    #[test]
    #[should_panic(expected = "l0.key: not an object")]
    fn key_array() {
        key(&array([s("a")]), 0);
    }

    #[test]
    #[should_panic(expected = "l0.key: not an index")]
    fn key_past() {
        key(&object([("a", n(1.0))]), 1);
    }

    #[test]
    #[should_panic(expected = "l0.find: not an object")]
    fn find_array() {
        find(&array([s("a")]), &s("a"));
    }

    #[test]
    #[should_panic(expected = "l0.find: not a string")]
    fn find_key() {
        find(&object([("1", n(1.0))]), &n(1.0));
    }

    #[test]
    #[should_panic(expected = "l0.same: not an array, an object or a function")]
    fn same_number() {
        same(&n(1.0), &n(1.0));
    }

    #[test]
    #[should_panic(expected = "l0.same: not an array, an object or a function")]
    fn same_string() {
        same(&array([]), &s("a"));
    }

    #[test]
    #[should_panic(expected = "l0.text: not a function")]
    fn text_object() {
        text(&object([]));
    }

    #[test]
    #[should_panic(expected = "l0.call: not a function")]
    fn call_object() {
        let _ = call(&object([]), &array([]));
    }

    #[test]
    #[should_panic(expected = "l0.call: not an array")]
    fn call_args() {
        let _ = call(&f2(), &object([]));
    }

    #[test]
    #[should_panic(expected = "l0.make_function: not an array")]
    fn make_function_frame() {
        make_function(pair, object([]), 0, None);
    }

    #[test]
    #[should_panic(expected = "l0.frame: not an index")]
    fn frame_past() {
        fn second(self_: &<A as IVm>::InternalFunction, _: Array<A>) -> Result<V, V> {
            Ok(frame(self_, 1))
        }
        let _ = call(&make_function(second, array([n(1.0)]), 0, None), &array([]));
    }

    #[test]
    #[should_panic(expected = "l0.unit: not a string")]
    fn unit_not_string() {
        unit(&array([s("a")]), 0);
    }

    #[test]
    #[should_panic(expected = "l0.unit: not an index")]
    fn unit_past() {
        unit(&s("a"), 1);
    }

    #[test]
    #[should_panic(expected = "l0.concat: not a string")]
    fn concat_first() {
        concat(&n(1.0), &s("a"));
    }

    #[test]
    #[should_panic(expected = "l0.concat: not a string")]
    fn concat_second() {
        concat(&s("a"), &n(1.0));
    }

    #[test]
    #[should_panic(expected = "l0.substring: not a string")]
    fn substring_not_string() {
        substring(&array([s("a")]), 0, 1);
    }

    #[test]
    #[should_panic(expected = "l0.substring: not an index")]
    fn substring_end_past() {
        substring(&s("ab"), 0, 3);
    }

    #[test]
    #[should_panic(expected = "l0.substring: not an index")]
    fn substring_backwards() {
        substring(&s("ab"), 2, 1);
    }

    #[test]
    #[should_panic(expected = "l0.join: not an array")]
    fn join_not_array() {
        join(&s("ab"), &s(","));
    }

    #[test]
    #[should_panic(expected = "l0.join: not a string")]
    fn join_part() {
        join(&array([s("a"), n(1.0)]), &s(","));
    }

    #[test]
    #[should_panic(expected = "l0.join: not a string")]
    fn join_separator() {
        join(&array([s("a")]), &n(0.0));
    }

    #[test]
    #[should_panic(expected = "l0.read_units: not a range")]
    fn read_units_past() {
        read_units(&s("ab"), 1, &mut [0; 2]);
    }

    #[test]
    #[should_panic(expected = "l0.read_words: not a range")]
    fn read_words_past() {
        read_words(&make_bigint::<A>(1, &[1]), 1, &mut [0; 1]);
    }

    #[test]
    #[should_panic(expected = "l0.sign: not a bigint")]
    fn sign_number() {
        sign(&n(1.0));
    }

    #[test]
    #[should_panic(expected = "l0.make_bigint: not canonical")]
    fn make_bigint_leading_zero() {
        make_bigint::<A>(1, &[1, 0]);
    }

    #[test]
    #[should_panic(expected = "l0.make_bigint: not canonical")]
    fn make_bigint_signed_zero() {
        make_bigint::<A>(1, &[]);
    }

    #[test]
    #[should_panic(expected = "l0.make_bigint: not canonical")]
    fn make_bigint_unsigned() {
        make_bigint::<A>(0, &[1]);
    }

    #[test]
    #[should_panic(expected = "l0.make_bigint: not canonical")]
    fn make_bigint_sign() {
        make_bigint::<A>(2, &[1]);
    }

    #[test]
    #[should_panic(expected = "l0.push: full")]
    fn push_past() {
        let mut b = begin_array::<A>(0);
        b.push(n(1.0));
    }

    #[test]
    #[should_panic(expected = "l0.push: not an array builder")]
    fn push_object() {
        let mut b = begin_object::<A>(1);
        b.push(n(1.0));
    }

    #[test]
    #[should_panic(expected = "l0.push_property: not an object builder")]
    fn push_property_array() {
        let mut b = begin_array::<A>(1);
        b.push_property(s("a"), n(1.0));
    }

    #[test]
    #[should_panic(expected = "l0.push_property: not a string")]
    fn push_property_key() {
        let mut b = begin_object::<A>(1);
        b.push_property(n(1.0), n(1.0));
    }

    #[test]
    #[should_panic(expected = "l0.seal: not full")]
    fn seal_short() {
        begin_array::<A>(1).seal();
    }
}
