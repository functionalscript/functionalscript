//! Key classification shared by every receiver's `.` / `[]`
//! (`Any::member_access`): `Array::member_access` and
//! `String::member_access` both index by an in-bounds integer, given as a
//! `Number` or its canonical decimal string, so the classification lives
//! once here rather than twice.

use crate::{
    common::sized_index::SizedIndex,
    vm::{IVm, Number, String},
};

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
