//! Reading the operations' requests from VM values and writing their results
//! to them: the handwritten half of the generated dispatch
//! (`gen.dispatch.rs`), which spells what each operation takes and answers
//! with these.
//!
//! A request is data a program built, so it can be wrong in ways a Rust
//! signature cannot be: it is read with [`Malformed`] as its failure, and that
//! is not an operation's own (`IoChannel`): it is the request that was not
//! one, which the JavaScript runners meet as an `assert`.
//!
//! A `Vec`, the bytes of a file, is the language's bit vector: a `bigint` whose
//! magnitude is the bits with a leading `1` as its stop bit, negative where
//! the first bit was `0`, and `0n` for none (`fjs/types/bit_vec`). Only
//! whole bytes are bytes here, as only whole bytes reach the Node runner.

use nanvm_lib::{
    common::sized_index::SizedIndex,
    vm::{
        Any, Array, BigInt, IVm, Nullish, Number, Object, String as VmString, ToAny, ToArray,
        ToObject, Unpacked,
        unstable::{bigint_any_words, string_any, string_key},
    },
};

/// A request that is not one the operation takes: what it was, in words.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Malformed(pub String);

fn malformed<T>(what: impl Into<String>) -> Result<T, Malformed> {
    Err(Malformed(what.into()))
}

// Reading

/// Argument `index` of the payload, which must be there.
pub fn argument<A: IVm>(payload: &[Any<A>], index: usize, name: &str) -> Result<Any<A>, Malformed> {
    match payload.get(index) {
        Some(any) => Ok(any.clone()),
        None => malformed(format!("missing argument {index}, `{name}`")),
    }
}

pub fn decode_string<A: IVm>(any: Any<A>) -> Result<String, Malformed> {
    let Ok(string) = VmString::try_from(any) else {
        return malformed("not a string");
    };
    let units: Vec<u16> = (0..string.length()).map(|i| string[i]).collect();
    Ok(String::from_utf16_lossy(&units))
}

pub fn decode_number<A: IVm>(any: Any<A>) -> Result<f64, Malformed> {
    match Number::try_from(any) {
        Ok(number) => Ok(f64::from(number)),
        Err(_) => malformed("not a number"),
    }
}

pub fn decode_bool<A: IVm>(any: Any<A>) -> Result<bool, Malformed> {
    match bool::try_from(any) {
        Ok(b) => Ok(b),
        Err(_) => malformed("not a boolean"),
    }
}

/// A `Vec` as its bytes: the magnitude's bits, big-endian, with the stop bit
/// cleared where the vector was negative. Bits that are not whole bytes are
/// refused.
pub fn decode_bytes<A: IVm>(any: Any<A>) -> Result<Vec<u8>, Malformed> {
    let Ok(vec) = BigInt::try_from(any) else {
        return malformed("not a bit vector");
    };
    let words = vec.length();
    if words == 0 {
        return Ok(Vec::new());
    }
    let negative = vec < BigInt::default();
    let top = vec[words - 1];
    let bits = 64 * (words - 1) + (64 - top.leading_zeros());
    if bits % 8 != 0 {
        return malformed("a bit vector that is not whole bytes");
    }
    let mut bytes: Vec<u8> = (0..bits / 8)
        .rev()
        .map(|i| (vec[i / 8] >> (8 * (i % 8))) as u8)
        .collect();
    if negative {
        bytes[0] &= 0x7f;
    }
    Ok(bytes)
}

/// `null` is `None`; anything else is read by `f`.
pub fn decode_nullable<A: IVm, T>(
    any: Any<A>,
    f: impl FnOnce(Any<A>) -> Result<T, Malformed>,
) -> Result<Option<T>, Malformed> {
    match Unpacked::from(any.clone()) {
        Unpacked::Nullish(Nullish::Null) => Ok(None),
        _ => f(any).map(Some),
    }
}

/// An argument or member that may be left out, or passed as `undefined`.
pub fn decode_optional<A: IVm, T>(
    any: Option<Any<A>>,
    f: impl FnOnce(Any<A>) -> Result<T, Malformed>,
) -> Result<Option<T>, Malformed> {
    match any {
        None => Ok(None),
        Some(any) => match Unpacked::from(any.clone()) {
            Unpacked::Nullish(Nullish::Undefined) => Ok(None),
            _ => f(any).map(Some),
        },
    }
}

/// A flag, `or(option, true)`: left out is `false`, `true` is `true`.
pub fn decode_flag<A: IVm>(any: Option<Any<A>>) -> Result<bool, Malformed> {
    match any {
        None => Ok(false),
        Some(any) => match bool::try_from(any) {
            Ok(true) => Ok(true),
            _ => malformed("a flag that is not `true`"),
        },
    }
}

/// An array read element by element.
pub fn decode_array<A: IVm, T>(
    any: Any<A>,
    f: impl Fn(Any<A>) -> Result<T, Malformed>,
) -> Result<Vec<T>, Malformed> {
    match Array::try_from(any) {
        Ok(array) => array.into_iter().map(f).collect(),
        Err(_) => malformed("not an array"),
    }
}

/// A constant: this very string.
pub fn decode_literal<A: IVm>(any: Any<A>, expected: &str) -> Result<(), Malformed> {
    if decode_string(any)? == expected {
        Ok(())
    } else {
        malformed(format!("not `{expected}`"))
    }
}

/// A constant: `true`.
pub fn decode_true<A: IVm>(any: Any<A>) -> Result<(), Malformed> {
    match bool::try_from(any) {
        Ok(true) => Ok(()),
        _ => malformed("not `true`"),
    }
}

/// One of the strings, as its position.
pub fn decode_choice<A: IVm>(any: Any<A>, choices: &[&str]) -> Result<usize, Malformed> {
    let chosen = decode_string(any)?;
    match choices.iter().position(|c| *c == chosen) {
        Some(i) => Ok(i),
        None => malformed(format!("`{chosen}` is not one of {choices:?}")),
    }
}

/// A closed struct: an object with these keys and no others.
pub fn decode_object<A: IVm>(any: Any<A>, keys: &[&str]) -> Result<Object<A>, Malformed> {
    let Ok(object) = Object::try_from(any) else {
        return malformed("not an object");
    };
    for (key, _) in object.own_entries() {
        let key = decode_string(ToAny::to_any::<A>(key))?;
        if !keys.contains(&key.as_str()) {
            return malformed(format!("unexpected member `{key}`"));
        }
    }
    Ok(object)
}

/// A member of a struct, if it is there.
pub fn member<A: IVm>(object: &Object<A>, key: &str) -> Option<Any<A>> {
    object.own_property(&string_key(key))
}

/// A member of a struct that must be there.
pub fn required<A: IVm>(object: &Object<A>, key: &str) -> Result<Any<A>, Malformed> {
    match member(object, key) {
        Some(any) => Ok(any),
        None => malformed(format!("missing member `{key}`")),
    }
}

// Writing

pub fn encode_string<A: IVm>(v: String) -> Any<A> {
    string_any(&v)
}

pub fn encode_number<A: IVm>(v: f64) -> Any<A> {
    Number::from(v).to_any()
}

pub fn encode_bool<A: IVm>(v: bool) -> Any<A> {
    v.to_any()
}

/// `undefined`, what an operation with nothing to return answers.
pub fn encode_nothing<A: IVm>(_: ()) -> Any<A> {
    Nullish::Undefined.to_any()
}

/// Bytes as a `Vec`: the bits with a stop bit in front, negated where the
/// first bit was `0`.
pub fn encode_bytes<A: IVm>(bytes: Vec<u8>) -> Any<A> {
    let Some(&first) = bytes.first() else {
        return bigint_any_words(false, &[]);
    };
    let words: Vec<u64> = bytes
        .rchunks(8)
        .map(|chunk| {
            chunk
                .iter()
                .fold(0u64, |word, &b| (word << 8) | u64::from(b))
        })
        .collect();
    let mut words = words;
    let last = words.len() - 1;
    let top_bits = 8 * (bytes.len() - 8 * last) as u32;
    words[last] |= 1u64 << (top_bits - 1);
    bigint_any_words(first & 0x80 == 0, &words)
}

pub fn encode_nullable<A: IVm, T>(v: Option<T>, f: impl FnOnce(T) -> Any<A>) -> Any<A> {
    match v {
        Some(v) => f(v),
        None => Nullish::Null.to_any(),
    }
}

pub fn encode_array<A: IVm, T>(v: Vec<T>, f: impl Fn(T) -> Any<A>) -> Any<A> {
    v.into_iter().map(f).collect::<Vec<_>>().to_array().to_any()
}

/// A struct: its members that are there, in order.
pub fn encode_object<A: IVm>(members: Vec<Option<(&str, Any<A>)>>) -> Any<A> {
    members
        .into_iter()
        .flatten()
        .map(|(key, value)| (string_key::<A>(key), value))
        .collect::<Vec<_>>()
        .to_object()
        .to_any()
}

/// A tagged tuple: `[tag, ...items]`.
pub fn encode_tuple<A: IVm>(tag: &str, items: Vec<Any<A>>) -> Any<A> {
    std::iter::once(string_any(tag))
        .chain(items)
        .collect::<Vec<_>>()
        .to_array()
        .to_any()
}

/// A `Result`: `['ok', value]` or `['error', failure]`.
pub fn encode_result<A: IVm, T, E>(
    v: Result<T, E>,
    ok: impl FnOnce(T) -> Any<A>,
    error: impl FnOnce(E) -> Any<A>,
) -> Any<A> {
    match v {
        Ok(v) => encode_tuple("ok", vec![ok(v)]),
        Err(e) => encode_tuple("error", vec![error(e)]),
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use nanvm_lib::{
        naive::Naive,
        vm::unstable::{bigint_any, f64_any},
    };

    type A = Any<Naive>;

    /// The vectors `toVec` of `fjs/types/uint8array` builds, by node: the bytes,
    /// the sign and the words of the magnitude, least significant first.
    const VECTORS: &[(&[u8], bool, &[u64])] = &[
        (&[], false, &[]),
        (&[0], true, &[0x80]),
        (&[255], false, &[0xff]),
        (&[1, 2], true, &[0x8102]),
        (&[0x80], false, &[0x80]),
        (&[0; 8], true, &[0x8000000000000000]),
        (
            &[1, 2, 3, 4, 5, 6, 7, 8, 9],
            true,
            &[0x203040506070809, 0x81],
        ),
        (&[0xff, 0, 0, 0, 0, 0, 0, 0, 1], false, &[0x1, 0xff]),
        (&[0x80, 1, 2, 3, 4, 5, 6, 7], false, &[0x8001020304050607]),
    ];

    #[test]
    fn bytes_are_the_languages_bit_vectors() {
        for &(bytes, negative, words) in VECTORS {
            let expected: A = bigint_any_words(negative, words);
            assert_eq!(encode_bytes::<Naive>(bytes.to_vec()), expected, "{bytes:?}");
            assert_eq!(decode_bytes(expected), Ok(bytes.to_vec()), "{bytes:?}");
        }
    }

    #[test]
    fn a_vec_that_is_not_bytes() {
        // `vec(4n)(0xDn)` is `0b1101n`: four bits.
        assert_eq!(
            decode_bytes::<Naive>(bigint_any(0b1101)),
            Err(Malformed("a bit vector that is not whole bytes".into()))
        );
        assert_eq!(
            decode_bytes::<Naive>("a".into()),
            Err(Malformed("not a bit vector".into()))
        );
    }

    #[test]
    fn scalars() {
        assert_eq!(
            decode_string::<Naive>("a\u{1F600}".into()),
            Ok("a\u{1F600}".to_string())
        );
        assert_eq!(
            decode_string::<Naive>(f64_any(0)),
            Err(Malformed("not a string".into()))
        );
        assert_eq!(decode_number::<Naive>(f64_any(0x4000000000000000)), Ok(2.0));
        assert_eq!(
            decode_number::<Naive>("2".into()),
            Err(Malformed("not a number".into()))
        );
        assert_eq!(decode_bool::<Naive>(true.to_any()), Ok(true));
        assert_eq!(
            decode_bool::<Naive>("true".into()),
            Err(Malformed("not a boolean".into()))
        );
        assert_eq!(encode_string::<Naive>("é".into()), "é".into());
        assert_eq!(encode_number::<Naive>(2.0), f64_any(0x4000000000000000));
        assert_eq!(encode_bool::<Naive>(false), false.to_any());
        assert_eq!(encode_nothing::<Naive>(()), Nullish::Undefined.to_any());
    }

    #[test]
    fn nullable_and_optional() {
        let null: A = Nullish::Null.to_any();
        let undefined: A = Nullish::Undefined.to_any();
        assert_eq!(decode_nullable(null.clone(), decode_string), Ok(None));
        assert_eq!(
            decode_nullable("a".into(), decode_string::<Naive>),
            Ok(Some("a".to_string()))
        );
        assert!(decode_nullable(undefined.clone(), decode_string).is_err());
        assert_eq!(decode_optional(None, decode_string::<Naive>), Ok(None));
        assert_eq!(decode_optional(Some(undefined), decode_string), Ok(None));
        assert_eq!(
            decode_optional(Some("a".into()), decode_string::<Naive>),
            Ok(Some("a".to_string()))
        );
        assert!(decode_optional(Some(null.clone()), decode_string).is_err());
        assert_eq!(
            encode_nullable(None::<String>, encode_string::<Naive>),
            null
        );
        assert_eq!(
            encode_nullable(Some("a".to_string()), encode_string::<Naive>),
            "a".into()
        );
        assert_eq!(decode_flag::<Naive>(None), Ok(false));
        assert_eq!(decode_flag(Some(true.to_any::<Naive>())), Ok(true));
        assert!(decode_flag(Some(false.to_any::<Naive>())).is_err());
    }

    /// Arrays are values by identity, as in the language, so what was written
    /// is read back.
    #[test]
    fn arrays_and_tuples() {
        let two: A = vec![f64_any(0), f64_any(0x3ff0000000000000)]
            .to_array()
            .to_any();
        assert_eq!(decode_array(two, decode_number), Ok(vec![0.0, 1.0]));
        assert!(decode_array("a".into(), decode_number::<Naive>).is_err());
        assert!(
            decode_array(
                vec![string_any::<Naive>("a")].to_array().to_any::<Naive>(),
                decode_number
            )
            .is_err()
        );
        let written = encode_array(vec![0.0, 1.0], encode_number::<Naive>);
        assert_eq!(decode_array(written, decode_number), Ok(vec![0.0, 1.0]));
        let parts = |any: A| decode_array(any, Ok);
        let ok = parts(encode_tuple("ok", vec![encode_number::<Naive>(1.0)])).unwrap();
        assert_eq!(ok, vec![string_any("ok"), f64_any(0x3ff0000000000000)]);
        let result = encode_result(
            Ok::<f64, String>(1.0),
            encode_number::<Naive>,
            encode_string,
        );
        assert_eq!(parts(result), Ok(ok));
        let result = encode_result(
            Err::<f64, String>("e".into()),
            encode_number::<Naive>,
            encode_string,
        );
        assert_eq!(
            parts(result),
            Ok(vec![string_any("error"), string_any("e")])
        );
    }

    #[test]
    fn literals_and_choices() {
        assert_eq!(decode_literal::<Naive>("stdin".into(), "stdin"), Ok(()));
        assert!(decode_literal::<Naive>("stdout".into(), "stdin").is_err());
        assert_eq!(decode_true(true.to_any::<Naive>()), Ok(()));
        assert!(decode_true(false.to_any::<Naive>()).is_err());
        assert_eq!(decode_choice::<Naive>("b".into(), &["a", "b"]), Ok(1));
        assert!(decode_choice::<Naive>("c".into(), &["a", "b"]).is_err());
    }

    #[test]
    fn structs() {
        let object: A = encode_object(vec![
            Some(("a", string_any("x"))),
            None,
            Some(("b", f64_any(0))),
        ]);
        let read = decode_object(object.clone(), &["a", "b", "c"]).unwrap();
        assert_eq!(member(&read, "a"), Some(string_any("x")));
        assert_eq!(member(&read, "c"), None);
        assert_eq!(required(&read, "b"), Ok(f64_any(0)));
        assert_eq!(
            required(&read, "c"),
            Err(Malformed("missing member `c`".into()))
        );
        assert_eq!(
            decode_object(object, &["a"]).map(|_| ()),
            Err(Malformed("unexpected member `b`".into()))
        );
        assert!(decode_object::<Naive>("a".into(), &[]).is_err());
    }

    #[test]
    fn arguments() {
        let payload: Vec<A> = vec!["a".into()];
        assert_eq!(argument(&payload, 0, "path"), Ok("a".into()));
        assert_eq!(
            argument(&payload, 1, "mode"),
            Err(Malformed("missing argument 1, `mode`".into()))
        );
    }
}
