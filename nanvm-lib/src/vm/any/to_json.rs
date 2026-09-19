use core::fmt::{self, Display, Formatter, Write};

use crate::{
    common::sized_index::SizedIndex,
    vm::{
        Any, Array, BigInt, Function, IVm, Object, String, dispatch::Dispatch, nullish::Nullish,
        string_coercion::number_to_string,
    },
};

/// An `Any<A>` shape [`Any::to_json`] does not (yet) know how to render.
///
/// Scoped deliberately: arrays and objects recurse (see [`Any::to_json`]),
/// so every remaining gap here bottoms out at a scalar with no direct JSON
/// counterpart — `mvp-roadmap.md`'s open question 3 ("does the MVP print DJS
/// for those, or report an error?") is left for later, so this reports an
/// error rather than guessing at a representation.
///
/// `to_json` itself is hand-written Rust standing in for FJS-compiled
/// logic — see `nanvm-lib/todo/to-json-fjs-migration.md` for the plan to
/// retire it once `fjs compile` can reach
/// `fjs/media/json/serializer/module.f.mjs`.
#[derive(Debug, PartialEq)]
pub enum JsonError {
    Undefined,
    NonFiniteNumber(f64),
    BigInt,
    Function,
}

impl Display for JsonError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            JsonError::Undefined => write!(f, "`undefined` has no JSON representation"),
            JsonError::NonFiniteNumber(v) => write!(f, "{v} has no JSON representation"),
            JsonError::BigInt => write!(f, "a BigInt has no JSON representation"),
            JsonError::Function => write!(f, "a function has no JSON representation"),
        }
    }
}

/// The `u32` value of `k` if ECMAScript's own-property enumeration treats it
/// as an "array index" — the keys `JSON.stringify` (via
/// `[[OwnPropertyKeys]]`) lists first, ascending, ahead of every other key
/// in insertion order: `ToString(ToUint32(key)) == key` and
/// `ToUint32(key) != 2^32 - 1`. ASCII digits only, no leading zero unless the
/// key is exactly `"0"`, and in range — `"01"` and `"4294967295"` are both
/// excluded, the first because its canonical form is `"1"`, not itself, the
/// second because it's the one `ToUint32` value the spec carves out.
///
/// [`ToJson::object`] uses this to sort an object's array-index keys ahead
/// of the rest, by this value rather than by the key's own text — `"10"`
/// sorts after `"2"` numerically, the opposite of their lexicographic order.
fn array_index_value<A: IVm>(k: &String<A>) -> Option<u32> {
    let units: std::vec::Vec<u16> = k.clone().into_iter().collect();
    let zero = b'0' as u16;
    if units == [zero] {
        return Some(0);
    }
    if units.is_empty()
        || units[0] == zero
        || !units.iter().all(|&u| (zero..=b'9' as u16).contains(&u))
    {
        return None;
    }
    let digits: std::string::String = units.iter().map(|&u| (u as u8) as char).collect();
    digits.parse::<u32>().ok().filter(|&n| n != u32::MAX)
}

/// Renders `v` as a JSON string literal, quotes and escapes included.
///
/// Shared by [`ToJson::string`] and object-key serialization
/// ([`ToJson::object`]): a key is itself a `String<A>` and needs exactly the
/// same escaping a string *value* does.
fn json_string<A: IVm>(v: String<A>) -> std::string::String {
    let mut out = std::string::String::from("\"");
    for r in char::decode_utf16(v) {
        match r {
            Ok('"') => out.push_str("\\\""),
            Ok('\\') => out.push_str("\\\\"),
            Ok('\u{8}') => out.push_str("\\b"),
            Ok('\u{c}') => out.push_str("\\f"),
            Ok('\n') => out.push_str("\\n"),
            Ok('\r') => out.push_str("\\r"),
            Ok('\t') => out.push_str("\\t"),
            Ok(c) if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            Ok(c) => out.push(c),
            // A lone UTF-16 surrogate has no Unicode text representation,
            // but well-formed JSON stringification (ES2019) still emits
            // it as its own `\uXXXX` escape rather than refusing the
            // whole string — the same convention this repository's own
            // JSON serializer follows
            // (`fjs/media/json/serializer/module.f.mjs`).
            Err(e) => {
                let _ = write!(out, "\\u{:04x}", e.unpaired_surrogate());
            }
        }
    }
    out.push('"');
    out
}

struct ToJson;

impl<A: IVm> Dispatch<A> for ToJson {
    type Result = Result<std::string::String, JsonError>;

    fn nullish(self, v: Nullish) -> Self::Result {
        match v {
            Nullish::Null => Ok("null".into()),
            Nullish::Undefined => Err(JsonError::Undefined),
        }
    }

    fn bool(self, v: bool) -> Self::Result {
        Ok(if v { "true" } else { "false" }.into())
    }

    fn number(self, v: f64) -> Self::Result {
        if !v.is_finite() {
            return Err(JsonError::NonFiniteNumber(v));
        }
        // `number_to_string` (`string_coercion.rs`) is `Number::toString`
        // proper: correct exponential-notation switching and the `-0` ->
        // `"0"` case, not Rust's `f64::to_string()` (which never switches to
        // exponential notation, so e.g. `1e21` would come out as a 22-digit
        // plain integer instead of `"1e+21"`). `v` is already known finite
        // above, so the `NaN`/`Infinity` spellings that function also
        // produces never surface here.
        Ok(number_to_string::<A>(v).into())
    }

    fn string(self, v: String<A>) -> Self::Result {
        Ok(json_string(v))
    }

    fn bigint(self, _: BigInt<A>) -> Self::Result {
        Err(JsonError::BigInt)
    }

    fn object(self, v: Object<A>) -> Self::Result {
        // An object's property list is never deduplicated on construction
        // (`own_property.rs`'s own doc comment), so a correct rendering has
        // to do what `JSON.stringify` does on the equivalent JS object:
        // each key's *last* value, kept at its *first* position. A bare
        // per-member loop would either repeat a key or pick the wrong
        // value, so the distinct keys are collected first, in first-seen
        // order, and each one's value is then a fresh `own_property` scan
        // (last-write-wins by construction — see that method's doc
        // comment).
        //
        // ECMAScript's own-property enumeration order (`[[OwnPropertyKeys]]`,
        // which `JSON.stringify` inherits) is not plain insertion order: an
        // array-index-like key (`array_index_value`) is listed first,
        // ascending by its numeric value, ahead of every other key, which
        // keeps its insertion order (`fjs/fsc/README.md`'s object-literal
        // section calls this out at the AST level). So the deduped keys are
        // partitioned into the two groups, the array-index group sorted, and
        // printed index keys first.
        let mut keys: Vec<String<A>> = Vec::new();
        for i in 0..v.length() {
            let (k, _) = &v[i];
            if !keys.iter().any(|seen| seen == k) {
                keys.push(k.clone());
            }
        }
        let mut index_keys: Vec<(u32, String<A>)> = Vec::new();
        let mut other_keys: Vec<String<A>> = Vec::new();
        for k in keys {
            match array_index_value(&k) {
                Some(n) => index_keys.push((n, k)),
                None => other_keys.push(k),
            }
        }
        index_keys.sort_by_key(|(n, _)| *n);
        let ordered = index_keys.into_iter().map(|(_, k)| k).chain(other_keys);
        let mut out = std::string::String::from("{");
        for (i, k) in ordered.enumerate() {
            if i > 0 {
                out.push(',');
            }
            out.push_str(&json_string(k.clone()));
            out.push(':');
            let value = v
                .own_property(&k)
                .expect("key was just read from this object's own properties");
            out.push_str(&value.to_json()?);
        }
        out.push('}');
        Ok(out)
    }

    fn array(self, v: Array<A>) -> Self::Result {
        let mut out = std::string::String::from("[");
        for (i, item) in v.index_iter().enumerate() {
            if i > 0 {
                out.push(',');
            }
            out.push_str(&item.to_json()?);
        }
        out.push(']');
        Ok(out)
    }

    fn function(self, _: Function<A>) -> Self::Result {
        Err(JsonError::Function)
    }
}

impl<A: IVm> Any<A> {
    /// An `Any<A>` -> JSON serializer covering everything with a direct JSON
    /// counterpart: numbers, strings, booleans, `null`, and arrays/objects
    /// recursed into. See [`JsonError`] for what's deliberately unhandled.
    pub fn to_json(self) -> Result<std::string::String, JsonError> {
        self.dispatch(ToJson)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Function, IContainer, IVm, String, ToAny, ToArray, ToObject, ToString},
    };

    type A = Naive;

    fn s(v: &str) -> crate::vm::Any<A> {
        String::<A>::from(v).to_any()
    }

    #[test]
    fn number() {
        assert_eq!(42.0.to_any::<A>().to_json(), Ok("42".into()));
        assert_eq!((-1.5).to_any::<A>().to_json(), Ok("-1.5".into()));
    }

    #[test]
    fn negative_zero_renders_as_zero() {
        // ECMAScript's `Number::toString(-0)` (and so `JSON.stringify(-0)`)
        // is `"0"`, not `"-0"` — handled by `number_to_string`.
        assert_eq!((-0.0).to_any::<A>().to_json(), Ok("0".into()));
    }

    #[test]
    fn large_and_small_magnitudes_use_exponential_notation() {
        // `f64::to_string()` never switches to exponential notation, but
        // `JSON.stringify` (via `Number::toString`) does; `number_to_string`
        // (`string_coercion.rs`) gets this right, so `to_json` inherits it.
        assert_eq!(1e21.to_any::<A>().to_json(), Ok("1e+21".into()));
        assert_eq!(1e-7.to_any::<A>().to_json(), Ok("1e-7".into()));
    }

    #[test]
    fn non_finite_number_errors() {
        // `NaN != NaN`, so this checks the variant by pattern rather than
        // `assert_eq!` against a `JsonError::NonFiniteNumber(f64::NAN)`.
        assert!(matches!(
            f64::NAN.to_any::<A>().to_json(),
            Err(super::JsonError::NonFiniteNumber(v)) if v.is_nan()
        ));
        assert_eq!(
            f64::INFINITY.to_any::<A>().to_json(),
            Err(super::JsonError::NonFiniteNumber(f64::INFINITY))
        );
    }

    #[test]
    fn string() {
        assert_eq!(s("hello").to_json(), Ok(r#""hello""#.into()));
        assert_eq!(s("a\"b\\c\nd").to_json(), Ok(r#""a\"b\\c\nd""#.into()));
    }

    #[test]
    fn backspace_and_form_feed_use_short_escapes() {
        // `JSON.stringify` spells U+0008/U+000C as the two-character `\b`/
        // `\f`, not the generic four-hex-digit `\u0008`/`\u000c` form.
        assert_eq!(s("\u{8}").to_json(), Ok(r#""\b""#.into()));
        assert_eq!(s("\u{c}").to_json(), Ok(r#""\f""#.into()));
    }

    #[test]
    fn unpaired_surrogate_is_escaped_not_an_error() {
        let lone_high_surrogate: String<A> = [0xd800u16].to_string();
        assert_eq!(
            lone_high_surrogate.to_any::<A>().to_json(),
            Ok(r#""\ud800""#.into())
        );
    }

    #[test]
    fn bigint_errors() {
        let bi: crate::vm::BigInt<A> = 123u64.into();
        assert_eq!(bi.to_any::<A>().to_json(), Err(super::JsonError::BigInt));
    }

    #[test]
    fn empty_array() {
        let a = [].to_array::<A>();
        assert_eq!(a.to_any::<A>().to_json(), Ok("[]".into()));
    }

    #[test]
    fn array_of_scalars() {
        let a: crate::vm::Array<A> = [1.0.to_any(), true.to_any(), s("x")].to_array();
        assert_eq!(a.to_any::<A>().to_json(), Ok(r#"[1,true,"x"]"#.into()));
    }

    #[test]
    fn nested_arrays() {
        let inner: crate::vm::Array<A> = [1.0.to_any()].to_array();
        let outer: crate::vm::Array<A> = [inner.to_any(), 2.0.to_any()].to_array();
        assert_eq!(outer.to_any::<A>().to_json(), Ok("[[1],2]".into()));
    }

    #[test]
    fn array_element_error_propagates_as_the_scalar_it_is() {
        // The element that can't serialize is what's reported, never a
        // generic "array" refusal — arrays themselves can no longer be the
        // *reason* a serialization fails now that they recurse.
        use crate::vm::Nullish;
        let a: crate::vm::Array<A> = [1.0.to_any(), Nullish::Undefined.to_any()].to_array();
        assert_eq!(a.to_any::<A>().to_json(), Err(super::JsonError::Undefined));
    }

    #[test]
    fn empty_object() {
        let o = [].to_object::<A>();
        assert_eq!(o.to_any::<A>().to_json(), Ok("{}".into()));
    }

    #[test]
    fn object_of_scalars() {
        let o: crate::vm::Object<A> =
            [("a".into(), 1.0.to_any()), ("b".into(), s("two"))].to_object();
        assert_eq!(o.to_any::<A>().to_json(), Ok(r#"{"a":1,"b":"two"}"#.into()));
    }

    #[test]
    fn nested_objects() {
        let inner: crate::vm::Object<A> = [("x".into(), 1.0.to_any())].to_object();
        let outer: crate::vm::Object<A> = [("a".into(), inner.to_any())].to_object();
        assert_eq!(outer.to_any::<A>().to_json(), Ok(r#"{"a":{"x":1}}"#.into()));
    }

    #[test]
    fn duplicate_key_keeps_last_value_at_first_position() {
        // `JSON.stringify({ a: 1, b: 2, a: 3 })` is `'{"a":3,"b":2}'`: the
        // later `a` wins the value, but the member list still shows `a`
        // first, since that's where it was first declared.
        let o: crate::vm::Object<A> = [
            ("a".into(), 1.0.to_any()),
            ("b".into(), 2.0.to_any()),
            ("a".into(), 3.0.to_any()),
        ]
        .to_object();
        assert_eq!(o.to_any::<A>().to_json(), Ok(r#"{"a":3,"b":2}"#.into()));
    }

    #[test]
    fn object_member_error_propagates_as_the_scalar_it_is() {
        use crate::vm::Nullish;
        let o: crate::vm::Object<A> = [("a".into(), Nullish::Undefined.to_any())].to_object();
        assert_eq!(o.to_any::<A>().to_json(), Err(super::JsonError::Undefined));
    }

    #[test]
    fn integer_like_keys_sort_ascending_ahead_of_other_keys() {
        // `JSON.stringify({ a: 0, 2: 2, 1: 1 })` is `'{"1":1,"2":2,"a":0}'`:
        // array-index keys first, ascending, regardless of where they were
        // written; `a` keeps its insertion position among the rest.
        let o: crate::vm::Object<A> = [
            ("a".into(), 0.0.to_any()),
            ("2".into(), 2.0.to_any()),
            ("1".into(), 1.0.to_any()),
        ]
        .to_object();
        assert_eq!(
            o.to_any::<A>().to_json(),
            Ok(r#"{"1":1,"2":2,"a":0}"#.into())
        );
    }

    #[test]
    fn integer_like_keys_sort_numerically_not_lexicographically() {
        // `"10"` sorts after `"2"` by value, the opposite of string order.
        let o: crate::vm::Object<A> = [("10".into(), s("b")), ("2".into(), s("a"))].to_object();
        assert_eq!(
            o.to_any::<A>().to_json(),
            Ok(r#"{"2":"a","10":"b"}"#.into())
        );
    }

    #[test]
    fn zero_key_sorts_first() {
        let o: crate::vm::Object<A> =
            [("b".into(), 1.0.to_any()), ("0".into(), 2.0.to_any())].to_object();
        assert_eq!(o.to_any::<A>().to_json(), Ok(r#"{"0":2,"b":1}"#.into()));
    }

    #[test]
    fn duplicate_integer_like_key_keeps_last_value_sorted_by_number() {
        // Dedup (last-write-wins) happens before the array-index sort, so a
        // repeated key's *value* is the last one written, but its *position*
        // among the other array-index keys is by number, not by either
        // occurrence's insertion order.
        let o: crate::vm::Object<A> = [
            ("1".into(), s("a")),
            ("0".into(), s("x")),
            ("1".into(), s("b")),
        ]
        .to_object();
        assert_eq!(o.to_any::<A>().to_json(), Ok(r#"{"0":"x","1":"b"}"#.into()));
    }

    #[test]
    fn leading_zero_key_is_not_integer_like() {
        // `"01"`'s canonical form is `"1"`, not itself — `ToUint32("01")` is
        // `1`, but `ToString(1)` is `"1"` ≠ `"01"`, so `JSON.stringify`
        // treats it as an ordinary insertion-order key, not an array index.
        let o: crate::vm::Object<A> = [("01".into(), s("a"))].to_object();
        assert_eq!(o.to_any::<A>().to_json(), Ok(r#"{"01":"a"}"#.into()));
    }

    #[test]
    fn max_uint32_key_is_not_integer_like() {
        // `2^32 - 1` (`4294967295`) is the one `ToUint32` value ECMAScript's
        // own array-index definition excludes.
        let o: crate::vm::Object<A> = [("4294967295".into(), s("a"))].to_object();
        assert_eq!(
            o.to_any::<A>().to_json(),
            Ok(r#"{"4294967295":"a"}"#.into())
        );
    }

    #[test]
    fn overflowing_digit_string_key_is_not_integer_like() {
        let o: crate::vm::Object<A> = [("99999999999".into(), s("a"))].to_object();
        assert_eq!(
            o.to_any::<A>().to_json(),
            Ok(r#"{"99999999999":"a"}"#.into())
        );
    }

    #[test]
    fn integer_like_key_nested_in_an_array_serializes() {
        let o: crate::vm::Object<A> = [("0".into(), 1.0.to_any())].to_object();
        let a: crate::vm::Array<A> = [o.to_any()].to_array();
        assert_eq!(a.to_any::<A>().to_json(), Ok(r#"[{"0":1}]"#.into()));
    }

    #[test]
    fn function_errors() {
        let name: String<A> = "f".into();
        let f: Function<A> = Function(<A as IVm>::InternalFunction::new_ok((name, 0), []));
        assert_eq!(f.to_any::<A>().to_json(), Err(super::JsonError::Function));
    }

    #[test]
    fn boolean() {
        assert_eq!(true.to_any::<A>().to_json(), Ok("true".into()));
        assert_eq!(false.to_any::<A>().to_json(), Ok("false".into()));
    }

    #[test]
    fn null_and_undefined() {
        use crate::vm::Nullish;
        assert_eq!(Nullish::Null.to_any::<A>().to_json(), Ok("null".into()));
        assert_eq!(
            Nullish::Undefined.to_any::<A>().to_json(),
            Err(super::JsonError::Undefined)
        );
    }
}
