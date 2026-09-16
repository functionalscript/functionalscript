//! Key classification shared by every receiver's `.` / `[]`
//! (`Any::member_access`, `nanvm-lib/todo/member-access-operator.md`):
//! `Array::member_access` and `String::member_access` both index by an
//! in-bounds integer, given as a `Number` or its canonical decimal string,
//! so the classification lives once here rather than twice.

use crate::vm::{IVm, String};

/// A `Number` key that denotes a valid array/string index: a non-negative
/// integer that fits in `u32`. `-0.0` passes (`-0.0 < 0.0` is `false` and
/// `(-0.0).fract()` is `0.0`), matching real JS: a numeric `-0` key
/// stringifies to `"0"` and indexes element `0`, unlike the *string* key
/// `"-0"`, which `string_to_index` below rejects (it round-trips to `"0"`,
/// not back to itself, so it never denotes an index).
pub(crate) fn canonical_index(n: f64) -> Option<u32> {
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
pub(crate) fn string_to_index<A: IVm>(s: &String<A>) -> Option<u32> {
    let text: std::string::String = s.clone().into();
    if text == "0" {
        return Some(0);
    }
    let mut chars = text.chars();
    match chars.next() {
        Some(first) if first.is_ascii_digit() && first != '0' => {}
        _ => return None,
    }
    if !chars.as_str().bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}
