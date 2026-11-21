//! Each native row against what its JavaScript body answers.

use super::super::{
    UNDEFINED, drop, from_f64, length, live, make_bigint_of, make_string_of, read_units_into,
    read_words_into, sign,
};
use super::*;

/// A binary row.
type Row = fn(i64, i64) -> i64;

fn fresh() {
    super::super::STATE.with_borrow_mut(|s| *s = super::super::State::new());
}

fn string(x: &str) -> i64 {
    make_string_of(&x.encode_utf16().collect::<Vec<_>>())
}

fn text(s: i64) -> std::string::String {
    let mut units: Vec<u16> = core::iter::repeat_n(0, length(s) as usize).collect();
    read_units_into(s, 0, &mut units);
    std::string::String::from_utf16(&units).unwrap()
}

fn big(x: i128) -> i64 {
    let m = x.unsigned_abs();
    let words: Vec<u64> = [m as u64, (m >> 64) as u64]
        .into_iter()
        .rev()
        .skip_while(|&w| w == 0)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    make_bigint_of(
        if words.is_empty() {
            0
        } else if x < 0 {
            -1
        } else {
            1
        },
        &words,
    )
}

fn value(b: i64) -> i128 {
    let mut words = [0; 2];
    let n = length(b) as usize;
    read_words_into(b, 0, &mut words[..n]);
    let m = i128::from(words[0]) | (i128::from(words[1]) << 64);
    if sign(b) < 0 { -m } else { m }
}

#[test]
fn numbers() {
    fresh();
    assert_eq!(number_remainder(7.0, -3.0), 1.0);
    assert_eq!(number_remainder(-7.0, 3.0), -1.0);
    assert!(number_remainder(1.0, 0.0).is_nan());
    assert!(number_remainder(f64::INFINITY, 2.0).is_nan());
    for (n, t) in [
        (0.0, "0"),
        (-0.0, "0"),
        (1.5, "1.5"),
        (-2.0, "-2"),
        (1e21, "1e+21"),
        (1e-7, "1e-7"),
        (f64::NAN, "NaN"),
        (f64::NEG_INFINITY, "-Infinity"),
        (0.1 + 0.2, "0.30000000000000004"),
    ] {
        let s = number_to_string(n);
        assert_eq!(text(s), t);
        drop(s);
    }
    for (t, n) in [
        ("", 0.0),
        (" 12 ", 12.0),
        ("0x10", 16.0),
        ("1e3", 1000.0),
        ("-Infinity", f64::NEG_INFINITY),
    ] {
        let s = string(t);
        assert_eq!(string_to_number(s), n);
        drop(s);
    }
    let s = string("12a");
    assert!(string_to_number(s).is_nan());
    drop(s);
    assert_eq!(live(), 0);
}

#[test]
fn bigints() {
    fresh();
    let (a, b) = (big(-10), big(3));
    let rows: [(Row, i128); 4] = [
        (bigint_add, -7),
        (bigint_subtract, -13),
        (bigint_multiply, -30),
        (bigint_divide, -3),
    ];
    for (row, expected) in rows {
        let r = row(a, b);
        assert_eq!(value(r), expected);
        drop(r);
    }
    let n = bigint_negate(a);
    assert_eq!(value(n), 10);
    let wide = big(1 << 70);
    let s = bigint_to_string(wide);
    assert_eq!(text(s), "1180591620717411303424");
    assert_eq!((bigint_equals(a, a), bigint_equals(a, b)), (1, 0));
    for h in [n, wide, s, a, b] {
        drop(h);
    }
    assert_eq!(live(), 0);
}

#[test]
fn bigint_less_is_mixed() {
    fresh();
    let (one, two) = (big(1), from_f64(2.0));
    let nan = from_f64(f64::NAN);
    let word = string("x");
    let digits = string("1");
    assert_eq!(bigint_less(one, two), 1.0);
    assert_eq!(bigint_less(two, one), 0.0);
    assert_eq!(bigint_less(one, digits), 0.0);
    assert_eq!(bigint_less(one, nan), -1.0);
    assert_eq!(bigint_less(word, one), -1.0);
    for h in [one, two, nan, word, digits] {
        drop(h);
    }
    assert_eq!(live(), 0);
}

#[test]
#[cfg(panic = "unwind")]
fn division_by_zero_throws() {
    use super::super::{catch, has_thrown};
    fresh();
    let (a, zero) = (big(1), big(0));
    let e = catch(|| bigint_divide(a, zero)).unwrap_err();
    assert_eq!(text(e), "RangeError: Division by zero");
    assert_eq!(has_thrown(), 0);
    drop(e);
}

#[test]
#[should_panic(expected = "l1.bigintAdd: not a bigint")]
fn add_not_a_bigint() {
    fresh();
    bigint_add(from_f64(1.0), big(1));
}

#[test]
#[should_panic(expected = "l1.bigintLess: not a bigint")]
fn less_without_a_bigint() {
    fresh();
    bigint_less(from_f64(1.0), UNDEFINED);
}

#[test]
#[should_panic(expected = "l1.bigintLess: not a numeric")]
fn less_of_a_non_numeric() {
    fresh();
    bigint_less(big(1), UNDEFINED);
}

#[test]
#[should_panic(expected = "l1.stringToNumber: not a string")]
fn string_to_number_not_a_string() {
    fresh();
    string_to_number(from_f64(1.0));
}
