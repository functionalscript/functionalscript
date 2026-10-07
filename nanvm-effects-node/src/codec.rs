//! Reading the operations' requests from VM values and writing their answers
//! to them, for the handwritten dispatch of [`crate::Native`].
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
        Any, BigInt, IVm, Nullish, Number, Object, String as VmString, ToAny, ToArray, ToObject,
        Unpacked,
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

/// The payload may hold no more than the operation's parameters: its
/// parameter tuple is closed.
pub fn arity<A: IVm>(payload: &[Any<A>], parameters: usize) -> Result<(), Malformed> {
    if payload.len() > parameters {
        return malformed(format!(
            "{} arguments where at most {parameters} are taken",
            payload.len()
        ));
    }
    Ok(())
}

pub fn decode_string<A: IVm>(any: Any<A>) -> Result<String, Malformed> {
    let Ok(string) = VmString::try_from(any) else {
        return malformed("not a string");
    };
    let units: Vec<u16> = (0..string.length()).map(|i| string[i]).collect();
    Ok(String::from_utf16_lossy(&units))
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

/// A constant: this very string.
pub fn decode_literal<A: IVm>(any: Any<A>, expected: &str) -> Result<(), Malformed> {
    if decode_string(any)? == expected {
        Ok(())
    } else {
        malformed(format!("not `{expected}`"))
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

pub fn decode_number<A: IVm>(any: Any<A>) -> Result<f64, Malformed> {
    match Number::try_from(any) {
        Ok(number) => Ok(f64::from(number)),
        Err(_) => malformed("not a number"),
    }
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

/// A constant: `true`.
pub fn decode_true<A: IVm>(any: Any<A>) -> Result<(), Malformed> {
    match bool::try_from(any) {
        Ok(true) => Ok(()),
        _ => malformed("not `true`"),
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

/// `undefined`, what an operation with nothing to return answers.
pub fn encode_nothing<A: IVm>(_: ()) -> Any<A> {
    Nullish::Undefined.to_any()
}

pub fn encode_nullable<A: IVm, T>(v: Option<T>, f: impl FnOnce(T) -> Any<A>) -> Any<A> {
    match v {
        Some(v) => f(v),
        None => Nullish::Null.to_any(),
    }
}

/// A tagged tuple: `[tag, ...items]`.
pub fn encode_tuple<A: IVm>(tag: &str, items: Vec<Any<A>>) -> Any<A> {
    std::iter::once(string_any(tag))
        .chain(items)
        .collect::<Vec<_>>()
        .to_array()
        .to_any()
}

pub fn encode_bool<A: IVm>(v: bool) -> Any<A> {
    v.to_any()
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

/// The `Result` of an operation that succeeded: `['ok', value]`.
pub fn encode_ok<A: IVm>(value: Any<A>) -> Any<A> {
    encode_tuple("ok", vec![value])
}
