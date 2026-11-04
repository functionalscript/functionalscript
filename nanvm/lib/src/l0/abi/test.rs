//! The ABI over handles: each function on handles and the memory, the
//! ownership of every handle, and a throw that traps, caught by the host.

use super::*;

/// A string, through the memory at `0`.
fn string(x: &str) -> i64 {
    let units: Vec<u8> = x.encode_utf16().flat_map(u16::to_le_bytes).collect();
    with_memory(|m| m[..units.len()].copy_from_slice(&units));
    make_string(0, (units.len() / 2) as i32)
}

/// A string's text, read through the memory at `0x8000`.
fn text_of(s: i64) -> std::string::String {
    let n = length(s);
    read_units(s, 0, n, 0x8000);
    let units: Vec<u16> = with_memory(|m| {
        m[0x8000..0x8000 + 2 * n as usize]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect()
    });
    std::string::String::from_utf16(&units).unwrap()
}

/// An array of handles it takes.
fn array(items: &[i64]) -> i64 {
    let b = begin_array(items.len() as i32);
    for &v in items {
        push(b, v);
    }
    seal(b)
}

fn panic_text(f: impl FnOnce()) -> std::string::String {
    let e = catch_unwind(AssertUnwindSafe(f)).unwrap_err();
    e.downcast_ref::<std::string::String>()
        .cloned()
        .unwrap_or_default()
}

#[test]
fn constants() {
    assert_eq!([UNDEFINED, NULL, FALSE, TRUE].map(kind), [0, 1, 2, 2]);
    assert_eq!(to_bool(TRUE), 1);
    assert_eq!(to_bool(FALSE), 0);
    assert_eq!(from_bool(7), TRUE);
    assert_eq!(from_bool(0), FALSE);
    assert_eq!(dup(NULL), NULL);
    drop(NULL);
    assert_eq!(kind(NULL), 1);
    assert_eq!(live(), 0);
}

#[test]
fn numbers() {
    let x = from_f64(1.5);
    assert_eq!(kind(x), 3);
    assert_eq!(to_f64(x), 1.5);
    let y = dup(x);
    assert_ne!(x, y);
    drop(x);
    assert_eq!(to_f64(y), 1.5);
    drop(y);
    assert_eq!(live(), 0);
}

#[test]
fn strings() {
    let a = string("h\u{e9}llo");
    assert_eq!(kind(a), 4);
    assert_eq!(length(a), 5);
    assert_eq!(unit(a, 1), 0xe9);
    assert_eq!(text_of(a), "h\u{e9}llo");
    let b = string(" world");
    let c = concat(a, b);
    assert_eq!(text_of(c), "h\u{e9}llo world");
    let d = substring(c, 6, 11);
    assert_eq!(text_of(d), "world");
    let u = from_unit(0x41);
    assert_eq!(text_of(u), "A");
    let sep = string(", ");
    let parts = array(&[a, b, u]);
    let j = join(parts, sep);
    assert_eq!(text_of(j), "h\u{e9}llo,  world, A");
    for h in [c, d, sep, parts, j] {
        drop(h);
    }
    assert_eq!(live(), 0);
}

#[test]
fn bigints() {
    let words: Vec<u8> = [1u64, 2].iter().flat_map(|w| w.to_le_bytes()).collect();
    with_memory(|m| m[16..32].copy_from_slice(&words));
    let b = make_bigint(-1, 16, 2);
    assert_eq!(kind(b), 5);
    assert_eq!(sign(b), -1);
    assert_eq!(length(b), 2);
    read_words(b, 1, 1, 64);
    assert_eq!(with_memory(|m| m[64..72].to_vec()), 2u64.to_le_bytes());
    let zero = make_bigint(0, 0, 0);
    assert_eq!(sign(zero), 0);
    drop(b);
    drop(zero);
    assert_eq!(live(), 0);
}

#[test]
fn containers() {
    let outer = begin_object(3);
    let inner = begin_array(1);
    push(inner, from_f64(1.0));
    push_property(outer, string("a"), seal(inner));
    push_property(outer, string("b"), TRUE);
    push_property(outer, string("a"), NULL);
    let o = seal(outer);
    assert_eq!(kind(o), 7);
    assert_eq!(length(o), 2);
    let k = key(o, 0);
    assert_eq!(text_of(k), "a");
    let v = item(o, 0);
    assert_eq!(v, NULL);
    let b = string("b");
    assert_eq!(find(o, b), 1);
    let x = string("x");
    assert_eq!(find(o, x), -1);
    let a = array(&[o]);
    let o2 = item(a, 0);
    assert_eq!(same(o2, item(a, 0)), 1);
    assert_eq!(live(), 6);
}

#[test]
fn push_takes_its_value() {
    let b = begin_array(1);
    push(b, from_f64(1.0));
    assert_eq!(live(), 0);
    let a = seal(b);
    assert_eq!(live(), 1);
    drop(a);
    assert_eq!(live(), 0);
}

/// `self => [frame[0], args]`: borrows both and answers an owned array.
fn first_and_args(self_: i64, args: i64) -> i64 {
    array(&[frame(self_, 0), dup(args)])
}

#[test]
fn functions() {
    let code = add_code(first_and_args);
    let f = make_function(code, array(&[string("x")]), 2, string("(a, b) => 0"));
    assert_eq!(kind(f), 8);
    assert_eq!(length(f), 2);
    let t = text(f);
    assert_eq!(text_of(t), "(a, b) => 0");
    let args = array(&[from_f64(4.0)]);
    let r = call(f, args);
    let x = item(r, 0);
    assert_eq!(text_of(x), "x");
    let a = item(r, 1);
    assert_eq!(same(a, args), 1);
    for h in [t, r, x, a, args, f] {
        drop(h);
    }
    assert_eq!(live(), 0);
    let g = make_function(code, array(&[]), 0, UNDEFINED);
    assert_eq!(text(g), UNDEFINED);
}

#[test]
fn texts_are_interned() {
    let code = add_code(first_and_args);
    let f = make_function(code, array(&[]), 0, string("() => 0"));
    let g = make_function(code, array(&[]), 0, string("() => 0"));
    assert_eq!(STATE.with_borrow(|s| s.texts.len()), 1);
    drop(f);
    drop(g);
}

/// `(v) => { throw v }`, after it opens a builder it never seals.
fn thrower(_: i64, args: i64) -> i64 {
    begin_array(2);
    throw(item(args, 0))
}

/// `(f, v) => f(v)`: one more frame between the host and the throw.
fn caller(_: i64, args: i64) -> i64 {
    let f = item(args, 0);
    let v = array(&[item(args, 1)]);
    let r = call(f, v);
    drop(v);
    drop(f);
    r
}

#[test]
fn a_throw_reaches_the_host() {
    let t = make_function(add_code(thrower), array(&[]), 1, UNDEFINED);
    let c = make_function(add_code(caller), array(&[]), 2, UNDEFINED);
    for _ in 0..3 {
        let args = array(&[dup(t), string("boom")]);
        let e = catch(|| call(c, args)).unwrap_err();
        assert_eq!(text_of(e), "boom");
        assert_eq!(has_thrown(), 0);
        assert_eq!(STATE.with_borrow(|s| s.builders.len()), 0);
        drop(e);
        drop(args);
    }
    // The runtime goes on: a call after the throws answers.
    let args = array(&[UNDEFINED]);
    let id = make_function(add_code(first_and_args), array(&[TRUE]), 1, UNDEFINED);
    let r = catch(|| call(id, args)).unwrap();
    assert_eq!(item(r, 0), TRUE);
}

#[test]
fn throw_undefined_is_a_throw() {
    let t = make_function(add_code(thrower), array(&[]), 1, UNDEFINED);
    let args = array(&[UNDEFINED]);
    assert_eq!(catch(|| call(t, args)), Err(UNDEFINED));
}

/// A NaNVM function whose Rust code answers `Err`, as the runtime's own
/// throws do.
fn native(_: &<A as IVm>::InternalFunction, _: Array<A>) -> Result<V, V> {
    Err("TypeError: no".into())
}

#[test]
fn a_rust_err_becomes_a_throw() {
    let f = put(super::super::make_function(
        native,
        super::super::begin_array(0).seal(),
        0,
        None,
    ));
    let args = array(&[]);
    let e = catch(|| call(f, args)).unwrap_err();
    assert_eq!(text_of(e), "TypeError: no");
}

#[test]
fn a_misuse_is_not_caught() {
    let s = string("a");
    let text = panic_text(|| {
        let _ = catch(|| from_f64(to_f64(s)));
    });
    assert_eq!(text, "l0.to_f64: not a number");
}

/// A misuse, and the trap it causes.
type Case = (&'static str, Box<dyn FnOnce()>);

#[test]
fn traps() {
    let s = string("a");
    let cases: [Case; 8] = [
        (
            "l0.kind: not a value",
            Box::new(|| {
                kind(99);
            }),
        ),
        (
            "l0.drop: not a value",
            Box::new(move || {
                drop(s);
                drop(s)
            }),
        ),
        (
            "l0.make_string: out of bounds",
            Box::new(|| {
                make_string(0xffff, 1);
            }),
        ),
        (
            "l0.read_units: out of bounds",
            Box::new(|| {
                let a = string("ab");
                read_units(a, 0, 2, 0xfffe);
            }),
        ),
        (
            "l0.from_unit: not a unit",
            Box::new(|| {
                from_unit(0x1_0000);
            }),
        ),
        (
            "l0.seal: not a builder",
            Box::new(|| {
                let b = begin_array(0);
                seal(b);
                seal(b);
            }),
        ),
        (
            "l0.make_function: not a code index",
            Box::new(|| {
                make_function(5, array(&[]), 0, UNDEFINED);
            }),
        ),
        (
            "l0.frame: not an index",
            Box::new(|| {
                let f = make_function(
                    add_code(|self_, _| frame(self_, 0)),
                    array(&[]),
                    0,
                    UNDEFINED,
                );
                call(f, array(&[]));
            }),
        ),
    ];
    for (expected, f) in cases {
        assert_eq!(panic_text(f), expected);
    }
}
