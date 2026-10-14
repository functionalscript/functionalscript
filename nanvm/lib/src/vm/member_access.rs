//! The indexed read every receiver's `.` / `[]` (`Any::dot`) and the
//! `entry` helper (`Any::entry`) share: an `Array` and a `String` both index
//! by an in-bounds integer, given as a `Number` or its canonical decimal
//! string, and both answer `"length"`, so the rule lives once here and each
//! receiver supplies only how it reads an element.
//!
//! Around every receiver read, `Any::entry` and the `.` node's `Member`
//! alike, sit the two policies they share: [`non_nullish_receiver`] opens
//! the read and [`undefined_if_absent`] closes it.

use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, Number, String, ToAny, Unpacked, error},
};

/// The receiver unpacked, or the `TypeError` a nullish receiver throws —
/// before any key handling, as `ToObject` runs before `ToPropertyKey`
/// (<https://tc39.es/ecma262/#sec-object.getownpropertydescriptor>).
pub(crate) fn non_nullish_receiver<A: IVm>(v: Any<A>) -> Result<Unpacked<A>, Any<A>> {
    let unpacked = Unpacked::from(v);
    if unpacked.is_nullish() {
        return Err(error::nullish_to_object());
    }
    Ok(unpacked)
}

/// The property read, `undefined` where the receiver has no such member.
pub(crate) fn undefined_if_absent<A: IVm>(v: Option<Any<A>>) -> Any<A> {
    v.unwrap_or_else(Any::undefined)
}

/// The one name every indexed receiver and a function answer besides their
/// indices: `Array`'s, `String`'s and `Function`'s `.length`.
pub(crate) const LENGTH: &str = "length";

/// `container[key]` for an indexed receiver: an in-bounds index — given as
/// a `Number` or its canonical decimal string — is `read`, the string key
/// `"length"` reads the length, and every other key is `None`, for the
/// caller (`Any::dot`) to turn into `undefined` — the same contract
/// `Object::member_access` and `Function::member_access` have.
///
/// `.length` is reachable only through the string key `"length"` — never
/// through a number, the way JS itself never lets
/// `array[array.length]` collide with `array["length"]`.
pub(crate) fn indexed_member_access<A: IVm, T: SizedIndex<u32>>(
    container: &T,
    key: Any<A>,
    read: impl FnOnce(&T, u32) -> Any<A>,
) -> Option<Any<A>> {
    match Unpacked::from(key) {
        Unpacked::Number(n) => in_bounds(container, canonical_index(n), read),
        Unpacked::String(s) if s.is_str(LENGTH) => Some(Number::from(container.length()).to_any()),
        Unpacked::String(s) => indexed_entry(container, &s, read),
        _ => None,
    }
}

/// The element a canonical index string names, `container["0"]`,
/// `container["1"]`, …, in bounds, as `read` reads it: the one kind of own
/// property an indexed receiver enumerates, and so what the `entry` helper
/// (`Any::entry`) reads of one — `.length` is own but not enumerable, and
/// `indexed_member_access` alone answers it.
pub(crate) fn indexed_entry<A: IVm, T: SizedIndex<u32>>(
    container: &T,
    key: &String<A>,
    read: impl FnOnce(&T, u32) -> Any<A>,
) -> Option<Any<A>> {
    in_bounds(container, string_to_index(key), read)
}

/// The element at `index`, when there is one and it is below
/// `container.length()`. The bound is checked before `read` runs, so a
/// receiver's own `Index<u32>`, which panics out of bounds by ordinary Rust
/// convention (`vm/array/index.rs`, `vm/string/index.rs`), is never
/// reached with a bad index.
fn in_bounds<A: IVm, T: SizedIndex<u32>>(
    container: &T,
    index: Option<u32>,
    read: impl FnOnce(&T, u32) -> Any<A>,
) -> Option<Any<A>> {
    index
        .filter(|&i| i < container.length())
        .map(|i| read(container, i))
}

/// A `Number` key that denotes a valid array/string index: a non-negative
/// integer that fits in `u32`. `-0.0` passes (`-0.0 < 0.0` is `false` and
/// `(-0.0).fract()` is `0.0`), matching real JS: a numeric `-0` key
/// stringifies to `"0"` and indexes element `0`, unlike the *string* key
/// `"-0"`, which `string_to_index` below rejects (it round-trips to `"0"`,
/// not back to itself, so it never denotes an index).
pub(crate) fn canonical_index(n: Number) -> Option<u32> {
    let n: f64 = n.into();
    if !n.is_finite() || n < 0.0 || n.fract() != 0.0 || n > u32::MAX as f64 {
        return None;
    }
    Some(n as u32)
}

/// A `String` key that is the canonical decimal form of an index: `"0"`,
/// or a nonempty run of ASCII digits with no leading zero. This is
/// deliberately narrower than `str::parse`, which alone would accept
/// `"01"` and `"+1"` — neither is `array[1]`'s or `string[1]`'s key in
/// real JS, only `["1"]` is, and admitting them here would make two
/// different strings read the same element.
///
/// Walks the UTF-16 code units directly (`String<A>`'s `Index<u32>` /
/// `SizedIndex`) instead of decoding the whole key into a heap-allocated
/// `std::string::String` first — this runs on every string-keyed
/// `Array`/`String` access, not just the rare match, so it avoids both the
/// allocation and `char::decode_utf16`'s lossy surrogate replacement for
/// what is otherwise a pure ASCII-digit scan.
pub(crate) fn string_to_index<A: IVm>(s: &String<A>) -> Option<u32> {
    let len = s.length();
    if len == 0 {
        return None;
    }
    let digit = |unit: u16| -> Option<u32> {
        (b'0' as u16..=b'9' as u16)
            .contains(&unit)
            .then(|| (unit - b'0' as u16) as u32)
    };
    let first = digit(s[0])?;
    if len == 1 {
        return Some(first);
    }
    // More than one digit: a leading zero (as in "01") is never canonical.
    if first == 0 {
        return None;
    }
    let mut value = first;
    for i in 1..len {
        value = value.checked_mul(10)?.checked_add(digit(s[i])?)?;
    }
    Some(value)
}

#[cfg(test)]
mod tests {
    use super::{indexed_entry, indexed_member_access};
    use crate::{
        naive::Naive,
        vm::{Any, Array, Number, String, ToAny, ToArray},
    };

    type A = Naive;

    /// What the element `i` reads as here: its index, so a check expects
    /// which element the rule reads rather than what it holds. What a read
    /// returns is each receiver's own (`vm/array/member_access.rs`,
    /// `vm/string/member_access.rs`).
    fn element(i: u32) -> Any<A> {
        Number::from(i).to_any()
    }

    /// `check`, against an `Array` and a `String` three elements long,
    /// handed `receiver[key]` and the entry a key names, each reading an
    /// element as `element`.
    fn each(check: impl Fn(&dyn Fn(Any<A>) -> Option<Any<A>>, &dyn Fn(&str) -> Option<Any<A>>)) {
        let array: Array<A> = ["a", "b", "c"].map(Any::from).to_array();
        check(
            &|key| indexed_member_access(&array, key, |_, i| element(i)),
            &|key| indexed_entry(&array, &key.into(), |_, i| element(i)),
        );
        let string: String<A> = "abc".into();
        check(
            &|key| indexed_member_access(&string, key, |_, i| element(i)),
            &|key| indexed_entry(&string, &key.into(), |_, i| element(i)),
        );
    }

    #[test]
    fn numeric_index_reads_element() {
        each(|get, _| {
            assert_eq!(get(0.0.to_any()), Some(element(0)));
            assert_eq!(get(2.0.to_any()), Some(element(2)));
        });
    }

    /// A numeric `-0` key stringifies to `"0"` before it is ever used as a
    /// key, in real JS as here, so it reads the same element `0` does —
    /// unlike the *string* key `"-0"`, which `non_canonical_string_index_is_none`
    /// below covers.
    #[test]
    fn negative_zero_index_reads_first_element() {
        each(|get, _| assert_eq!(get((-0.0f64).to_any()), Some(element(0))));
    }

    #[test]
    fn non_integer_or_negative_numeric_index_is_none() {
        each(|get, _| {
            assert_eq!(get(0.5.to_any()), None);
            assert_eq!(get((-1.0f64).to_any()), None);
        });
    }

    #[test]
    fn canonical_string_index_reads_element() {
        each(|get, _| {
            assert_eq!(get("0".into()), Some(element(0)));
            assert_eq!(get("2".into()), Some(element(2)));
        });
    }

    /// None of these round-trip to themselves through `ToNumber` then
    /// `ToString` the way `"0"`/`"1"`/… do, so none of them is the
    /// canonical form of any index — admitting them would let two
    /// different strings read the same element.
    #[test]
    fn non_canonical_string_index_is_none() {
        each(|get, _| {
            for key in ["01", "+0", "1.0", " 0", "-0", ""] {
                assert_eq!(
                    get(key.into()),
                    None,
                    "key {key:?} must not read an element"
                );
            }
        });
    }

    /// The index `3` on a receiver three elements long is out of range,
    /// as a number or as a string. `.length` is looked up only through the
    /// string key `"length"`, so the number `3` is not a second spelling
    /// of it.
    #[test]
    fn out_of_range_index_is_none() {
        each(|get, _| {
            assert_eq!(get(3.0.to_any()), None);
            assert_eq!(get("3".into()), None);
        });
    }

    #[test]
    fn length_key_reads_length() {
        each(|get, _| assert_eq!(get("length".into()), Some(3.0.to_any())));
    }

    #[test]
    fn unrelated_key_is_none() {
        each(|get, _| assert_eq!(get(true.to_any()), None));
    }

    /// An entry is an element and never the length.
    #[test]
    fn entry_reads_element_not_length() {
        each(|_, entry| {
            assert_eq!(entry("1"), Some(element(1)));
            assert_eq!(entry("3"), None);
            assert_eq!(entry("01"), None);
            assert_eq!(entry("length"), None);
        });
    }
}
