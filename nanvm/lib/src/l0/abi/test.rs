//! The ABI over handles: each function on handles and the memory, the
//! ownership of every handle, and a throw that traps, caught by the host.

use super::*;

/// A new runtime for each test. Natively each test has a thread, and so a
/// runtime, of its own, but under `wasm32-wasip1` the tests share one
/// thread.
/// Bits that are no value: a scalar tag that no value has.
const NOT_A_VALUE: i64 = 0x7FF0_0000_0000_0040;

fn fresh() {
    with(|s| *s = State::new());
}

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
            .as_chunks::<2>()
            .0
            .iter()
            .map(|&c| u16::from_le_bytes(c))
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

#[test]
fn constants() {
    fresh();
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
    fresh();
    // A number is its own bits: it takes no slot, and `dup` answers it.
    let x = from_f64(1.5);
    assert_eq!(x, 1.5_f64.to_bits() as i64);
    assert_eq!(kind(x), 3);
    assert_eq!(to_f64(x), 1.5);
    assert_eq!(dup(x), x);
    drop(x);
    assert_eq!(live(), 0);
    // Every NaN is the one NaN, and the infinities are numbers.
    assert_eq!(
        from_f64(f64::from_bits(0x7FF8_0000_0000_0001)),
        from_f64(f64::NAN)
    );
    assert_eq!(from_f64(f64::NAN) as u64, 0x7FF8_0000_0000_0000);
    assert_eq!(
        [f64::INFINITY, f64::NEG_INFINITY, -0.0].map(|x| to_f64(from_f64(x)).to_bits()),
        [f64::INFINITY, f64::NEG_INFINITY, -0.0].map(f64::to_bits)
    );
    assert_eq!(kind(from_f64(f64::NEG_INFINITY)), 3);
}

#[test]
fn strings() {
    fresh();
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
fn short_strings_accept() {
    fresh();
    let empty = short::EMPTY as i64;
    assert_eq!(kind(empty), 4);
    assert_eq!(length(empty), 0);
    assert_eq!(text_of(empty), "");
    assert_eq!(dup(empty), empty);
    drop(empty);
    assert_eq!(live(), 0);
    let a = short::pack(&[0x61]).unwrap() as i64;
    let ab = short::pack(&[0x61, 0x62]).unwrap() as i64;
    assert_eq!(kind(a), 4);
    assert_eq!(unit(a, 0), 0x61);
    assert_eq!(text_of(ab), "ab");
    assert_eq!(length(ab), 2);
    // Short-family bits that match no Sergey tag are not a value.
    let junk = 0x7FF0_0000_0000_00E8_u64 as i64;
    assert!(short::is_short(junk as u64));
    assert_eq!(short::tag_of(junk as u64), None);
}

#[test]
#[should_panic(expected = "l0.kind: not a value")]
fn short_strings_junk_traps() {
    fresh();
    kind(0x7FF0_0000_0000_00E8_u64 as i64);
}

#[test]
fn short_strings_emit() {
    fresh();
    set_string_emit_short(true);
    let empty = string("");
    assert_eq!(empty as u64, short::EMPTY);
    assert_eq!(live(), 0);
    let a = from_unit(0x41);
    assert_eq!(text_of(a), "A");
    assert_eq!(kind(a), 4);
    assert_eq!(a as u64, short::pack(&[0x41]).unwrap());
    assert_eq!(live(), 0);
    let ab = concat(from_unit(0x61), from_unit(0x62));
    assert_eq!(text_of(ab), "ab");
    assert_eq!(ab as u64, short::pack(&[0x61, 0x62]).unwrap());
    assert_eq!(live(), 0);
    // Three units fit a Sergey tag but not the v1 enabled set → dyn-ref.
    let abc = string("abc");
    assert_eq!(text_of(abc), "abc");
    assert_eq!(live(), 1);
    drop(abc);
    assert_eq!(live(), 0);
}

#[test]
fn bigints() {
    fresh();
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
    fresh();
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
    fresh();
    let b = begin_array(1);
    push(b, from_f64(1.0));
    assert_eq!(live(), 0);
    let a = seal(b);
    assert_eq!(live(), 1);
    drop(a);
    assert_eq!(live(), 0);
}

#[test]
fn push_all_borrows_its_array() {
    fresh();
    let a = array(&[from_f64(1.0), TRUE]);
    let b = begin_array(3);
    push(b, NULL);
    push_all(b, a);
    assert_eq!(live(), 1);
    let c = seal(b);
    assert_eq!(length(c), 3);
    let one = item(c, 1);
    assert_eq!(to_f64(one), 1.0);
    assert_eq!(item(c, 2), TRUE);
    drop(one);
    drop(a);
    drop(c);
    assert_eq!(live(), 0);
}

/// `self => [frame[0], args]`: borrows both and answers an owned array.
fn first_and_args(self_: i64, args: i64) -> i64 {
    array(&[frame(self_, 0), dup(args)])
}

#[test]
fn functions() {
    fresh();
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

/// A host's code: `[code, frame[0], args]` for any index past the table.
fn host_code(code: i32, self_: i64, args: i64) -> i64 {
    array(&[from_f64(f64::from(code)), frame(self_, 0), dup(args)])
}

#[test]
fn host_code_runs_every_index_past_the_table() {
    fresh();
    let code = add_code(first_and_args);
    set_host_code(host_code);
    let f = make_function(code, array(&[TRUE]), 0, UNDEFINED);
    let g = make_function(7, array(&[NULL]), 0, UNDEFINED);
    let args = array(&[]);
    let r = call(f, args);
    assert_eq!(length(r), 2);
    let s = call(g, args);
    let k = item(s, 0);
    assert_eq!(to_f64(k), 7.0);
    assert_eq!(item(s, 1), NULL);
    for h in [r, s, k, args, f, g] {
        drop(h);
    }
    assert_eq!(live(), 0);
}

#[test]
fn bytes_of_a_host_buffer() {
    fresh();
    let s = make_string_of(&[0x61, 0xd800]);
    let mut units = [0; 2];
    read_units_into(s, 0, &mut units);
    assert_eq!(units, [0x61, 0xd800]);
    assert_eq!((alive(s), alive(UNDEFINED), alive(NOT_A_VALUE)), (1, 1, 0));
    let builder = begin_array(0);
    assert_eq!(open_builders(), 1);
    drop(seal(builder));
    assert_eq!(open_builders(), 0);
    let b = make_bigint_of(-1, &[5, 1]);
    let mut words = [0; 2];
    read_words_into(b, 0, &mut words);
    assert_eq!((sign(b), words), (-1, [5, 1]));
    drop(s);
    drop(b);
    assert_eq!(live(), 0);
}

#[test]
fn texts_are_interned() {
    fresh();
    let code = add_code(first_and_args);
    let f = make_function(code, array(&[]), 0, string("() => 0"));
    let g = make_function(code, array(&[]), 0, string("() => 0"));
    assert_eq!(with(|s| s.texts.len()), 1);
    drop(f);
    drop(g);
}

// A throw caught by the host needs `panic = "unwind"` natively, like
// `should_panic`.

/// `(v) => { throw v }`, after it opens a builder it never seals.
#[cfg(panic = "unwind")]
fn thrower(_: i64, args: i64) -> i64 {
    begin_array(2);
    throw(item(args, 0))
}

/// `(f, v) => f(v)`: one more frame between the host and the throw.
#[cfg(panic = "unwind")]
fn caller(_: i64, args: i64) -> i64 {
    let f = item(args, 0);
    let v = array(&[item(args, 1)]);
    let r = call(f, v);
    drop(v);
    drop(f);
    r
}

#[test]
#[cfg(panic = "unwind")]
fn a_throw_reaches_the_host() {
    fresh();
    let t = make_function(add_code(thrower), array(&[]), 1, UNDEFINED);
    let c = make_function(add_code(caller), array(&[]), 2, UNDEFINED);
    let before = live();
    for _ in 0..3 {
        let args = array(&[dup(t), string("boom")]);
        let e = catch(|| call(c, args)).unwrap_err();
        assert_eq!(text_of(e), "boom");
        assert_eq!(has_thrown(), 0);
        assert_eq!(with(|s| s.builders.count()), 0);
        drop(e);
        drop(args);
        // What the abandoned frames held is freed: nothing leaks.
        assert_eq!(live(), before);
    }
    // The runtime goes on: a call after the throws answers.
    let args = array(&[UNDEFINED]);
    let id = make_function(add_code(first_and_args), array(&[TRUE]), 1, UNDEFINED);
    let r = catch(|| call(id, args)).unwrap();
    assert_eq!(item(r, 0), TRUE);
}

#[test]
#[cfg(panic = "unwind")]
fn throw_undefined_is_a_throw() {
    fresh();
    let t = make_function(add_code(thrower), array(&[]), 1, UNDEFINED);
    let args = array(&[UNDEFINED]);
    assert_eq!(catch(|| call(t, args)), Err(UNDEFINED));
}

/// A NaNVM function whose Rust code answers `Err`, as the runtime's own
/// throws do.
#[cfg(panic = "unwind")]
fn native(_: &<A as IVm>::InternalFunction, _: Array<A>) -> Result<V, V> {
    Err("TypeError: no".into())
}

#[test]
#[cfg(panic = "unwind")]
fn a_rust_err_becomes_a_throw() {
    fresh();
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

/// A trap that is not a throw passes through [`catch`].
#[test]
#[cfg(panic = "unwind")]
#[should_panic(expected = "l0.to_f64: not a number")]
fn a_misuse_is_not_caught() {
    fresh();
    let s = string("a");
    let _ = catch(|| from_f64(to_f64(s)));
}

// The traps. With `panic = "abort"`, as on `wasm32-wasip1`, the test
// harness does not run a `should_panic` test.

#[test]
#[should_panic(expected = "l0.kind: not a value")]
fn not_a_value() {
    fresh();
    kind(NOT_A_VALUE);
}

#[test]
#[should_panic(expected = "l0.drop: not a value")]
fn drop_twice() {
    fresh();
    let s = string("a");
    drop(s);
    drop(s);
}

#[test]
#[should_panic(expected = "l0.length: not a value")]
fn a_dropped_handle_is_not_its_slot_s_next_value() {
    fresh();
    let old = make_string_of(&[0x61]);
    drop(old);
    let new = make_string_of(&[0x62]);
    assert_ne!(old, new);
    length(old);
}

#[test]
#[should_panic(expected = "l0.push: not a builder")]
fn a_sealed_builder_is_not_its_slot_s_next_builder() {
    fresh();
    let old = begin_array(0);
    seal(old);
    let new = begin_array(1);
    assert_ne!(old, new);
    push(old, TRUE);
}

#[test]
#[should_panic(expected = "l0.make_string: out of bounds")]
fn make_string_out_of_bounds() {
    fresh();
    make_string(0xffff, 1);
}

#[test]
#[should_panic(expected = "l0.read_units: out of bounds")]
fn read_units_out_of_bounds() {
    fresh();
    let a = string("ab");
    read_units(a, 0, 2, 0xfffe);
}

#[test]
#[should_panic(expected = "l0.read_units: out of bounds")]
fn read_units_negative_length() {
    fresh();
    let a = string("ab");
    read_units(a, 0, -1, 0);
}

#[test]
#[should_panic(expected = "l0.from_unit: not a unit")]
fn from_unit_not_a_unit() {
    fresh();
    from_unit(0x1_0000);
}

#[test]
#[should_panic(expected = "l0.seal: not a builder")]
fn seal_twice() {
    fresh();
    let b = begin_array(0);
    seal(b);
    seal(b);
}

#[test]
#[should_panic(expected = "l0.make_function: not a code index")]
fn make_function_not_a_code_index() {
    fresh();
    make_function(5, array(&[]), 0, UNDEFINED);
}

#[test]
#[should_panic(expected = "l0.frame: not an index")]
fn frame_not_an_index() {
    fresh();
    let f = make_function(
        add_code(|self_, _| frame(self_, 0)),
        array(&[]),
        0,
        UNDEFINED,
    );
    call(f, array(&[]));
}

#[test]
#[should_panic(expected = "l0.seal: not a builder")]
fn a_spent_builder_slot_is_retired() {
    fresh();
    let first = begin_array(0);
    seal(first);
    for _ in 0..0x8000 {
        let b = begin_array(0);
        assert_ne!(b, first);
        seal(b);
    }
    seal(first);
}

#[test]
#[should_panic(expected = "l0.begin_array: not a count")]
fn begin_array_negative() {
    fresh();
    begin_array(-1);
}

#[test]
#[should_panic(expected = "l0.begin_object: not a count")]
fn begin_object_negative() {
    fresh();
    begin_object(-1);
}

#[test]
#[should_panic(expected = "l0.make_function: not a count")]
fn make_function_negative_length() {
    fresh();
    make_function(add_code(first_and_args), array(&[]), -1, UNDEFINED);
}

#[test]
#[cfg(panic = "unwind")]
fn recover_frees_only_the_inner_call() {
    fresh();
    let t = make_function(add_code(thrower), array(&[]), 1, UNDEFINED);
    let r = catch(|| {
        let kept = from_f64(7.0);
        let args = array(&[string("inner")]);
        let e = catch(|| call(t, args)).unwrap_err();
        assert_eq!(text_of(e), "inner");
        // The outer call's handles survive the inner call's recovery.
        assert_eq!(to_f64(kept), 7.0);
        drop(e);
        drop(args);
        kept
    })
    .unwrap();
    assert_eq!(to_f64(r), 7.0);
    assert_eq!(with(|s| s.marks.len()), 0);
}

#[test]
fn recover_without_a_mark_frees_nothing() {
    fresh();
    let x = from_f64(1.0);
    recover();
    assert_eq!(to_f64(x), 1.0);
}

#[cfg(panic = "unwind")]
#[test]
fn recover_after_a_misuse_frees_since_the_mark() {
    fresh();
    let kept = string("a");
    enter();
    let left = string("b");
    // A misuse traps with nothing thrown: what the call made is abandoned.
    assert!(catch_unwind(|| concat(left, from_f64(1.0))).is_err());
    assert_eq!(has_thrown(), 0);
    recover();
    assert_eq!((alive(kept), alive(left)), (1, 0));
}

// A read runs inside the state, so its trap must end the change.

#[cfg(panic = "unwind")]
#[test]
fn a_trap_inside_a_read_leaves_the_state_usable() {
    fresh();
    let a = array(&[from_f64(1.0)]);
    let s = string("ab");
    assert!(catch_unwind(|| item(a, 5)).is_err());
    assert!(catch_unwind(|| unit(s, 2)).is_err());
    assert!(catch_unwind(|| concat(s, a)).is_err());
    assert_eq!(length(a), 1);
    assert_eq!(to_f64(item(a, 0)), 1.0);
    assert_eq!(text_of(concat(s, s)), "abab");
}

#[test]
#[should_panic(expected = "l0.concat: not a value")]
fn concat_second_not_a_value() {
    fresh();
    let s = string("a");
    concat(s, NOT_A_VALUE);
}

#[test]
#[should_panic(expected = "l0.find: not a value")]
fn find_first_not_a_value() {
    fresh();
    let s = string("a");
    find(NOT_A_VALUE, s);
}

// References only.

#[test]
fn references_only() {
    fresh();
    let s = string("a");
    let a = array(&[]);
    let b = array(&[]);
    let before = live();
    assert_eq!(kind_ref(s), 4);
    assert_eq!(kind_ref(a), 6);
    let d = dup_ref(a);
    assert_ne!(d, a);
    assert_eq!(same_ref(a, d), 1);
    assert_eq!(same_ref(a, a), 1);
    assert_eq!(same_ref(a, b), 0);
    drop_ref(d);
    assert_eq!(live(), before);
    drop_ref(s);
    drop_ref(a);
    drop_ref(b);
    assert_eq!(live(), before - 3);
}

#[test]
#[should_panic(expected = "l0.kind_ref: not a reference")]
fn kind_ref_of_a_number() {
    fresh();
    kind_ref(from_f64(1.0));
}

#[test]
#[should_panic(expected = "l0.dup_ref: not a reference")]
fn dup_ref_of_a_constant() {
    fresh();
    dup_ref(TRUE);
}

#[test]
#[should_panic(expected = "l0.drop_ref: not a reference")]
fn drop_ref_of_a_constant() {
    fresh();
    drop_ref(UNDEFINED);
}

#[test]
#[should_panic(expected = "l0.same_ref: not a reference")]
fn same_ref_of_two_numbers() {
    fresh();
    same_ref(from_f64(1.0), from_f64(1.0));
}

#[test]
#[should_panic(expected = "l0.kind_ref: not a value")]
fn kind_ref_of_a_dropped_reference() {
    fresh();
    let s = string("a");
    drop_ref(s);
    kind_ref(s);
}

#[test]
#[should_panic(expected = "l0.same_ref: not a value")]
fn same_ref_of_one_dropped_reference_twice() {
    fresh();
    let a = array(&[]);
    drop_ref(a);
    same_ref(a, a);
}

#[test]
#[should_panic(expected = "l0.drop_ref: not a value")]
fn drop_ref_twice() {
    fresh();
    let s = string("a");
    drop_ref(s);
    drop_ref(s);
}
