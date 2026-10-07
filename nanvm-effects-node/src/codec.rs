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
        Any, Array, BigInt, IVm, Nullish, Number, String as VmString, ToAny, ToArray,
        unstable::string_any,
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
pub fn argument<A: IVm>(payload: &Array<A>, index: u32, name: &str) -> Result<Any<A>, Malformed> {
    match optional_argument(payload, index) {
        Some(any) => Ok(any),
        None => malformed(format!("missing argument {index}, `{name}`")),
    }
}

/// Argument `index` of the payload, if it is there.
pub fn optional_argument<A: IVm>(payload: &Array<A>, index: u32) -> Option<Any<A>> {
    (index < payload.length()).then(|| payload[index].clone())
}

/// The payload may hold no more than the operation's parameters: its
/// parameter tuple is closed.
pub fn arity<A: IVm>(payload: &Array<A>, parameters: u32) -> Result<(), Malformed> {
    if payload.length() > parameters {
        return malformed(format!(
            "{} arguments where at most {parameters} are taken",
            payload.length()
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

/// A tagged tuple: `[tag, item]`.
pub fn encode_tuple<A: IVm>(tag: &str, item: Any<A>) -> Any<A> {
    [string_any(tag), item].to_array().to_any()
}

/// The `Result` of an operation that succeeded: `['ok', value]`.
pub fn encode_ok<A: IVm>(value: Any<A>) -> Any<A> {
    encode_tuple("ok", value)
}
