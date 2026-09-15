use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, String, ToAny, Unpacked},
};

impl<A: IVm> Array<A> {
    /// `self[key]`: an in-bounds index — given as a `Number` or its
    /// canonical decimal string — reads the element, the string key
    /// `"length"` reads the length, and every other key is `None` — for
    /// the caller (`Any::member_access`) to turn into `undefined`, the same
    /// contract `Object::own_property` has for `Any::own_property`.
    ///
    /// Never panics on an out-of-range index: `index < len` is checked
    /// before indexing, so `Array`'s own `Index<u32>` (which still panics
    /// out of bounds, by ordinary Rust convention — see `vm/array/index.rs`)
    /// is never reached with a bad index.
    ///
    /// `.length` is reachable only through the string key `"length"` —
    /// never through a number, the way JS itself never lets
    /// `array[array.length]` collide with `array["length"]`.
    pub(crate) fn member_access(&self, key: Any<A>) -> Option<Any<A>> {
        let len = self.length();
        match Unpacked::from(key) {
            Unpacked::Number(n) => canonical_index(n)
                .filter(|&i| i < len)
                .map(|i| self[i].clone()),
            Unpacked::String(s) => {
                if s == "length".into() {
                    Some((len as f64).to_any())
                } else {
                    string_to_index(&s)
                        .filter(|&i| i < len)
                        .map(|i| self[i].clone())
                }
            }
            _ => None,
        }
    }
}

/// A `Number` key that denotes a valid array index: a non-negative integer
/// that fits in `u32`. `-0.0` passes (`-0.0 < 0.0` is `false` and
/// `(-0.0).fract()` is `0.0`), matching real JS: a numeric `-0` key
/// stringifies to `"0"` and indexes element `0`, unlike the *string* key
/// `"-0"`, which `string_to_index` below rejects (it round-trips to `"0"`,
/// not back to itself, so it never denotes an index).
fn canonical_index(n: f64) -> Option<u32> {
    if !n.is_finite() || n < 0.0 || n.fract() != 0.0 || n > u32::MAX as f64 {
        return None;
    }
    Some(n as u32)
}

/// A `String` key that is the canonical decimal form of an array index:
/// `"0"`, or a nonempty run of ASCII digits with no leading zero. This is
/// deliberately narrower than `str::parse`, which alone would accept
/// `"01"` and `"+1"` — neither is `array[1]`'s key in real JS, only
/// `array["1"]` is, and admitting them here would make two different
/// strings read the same element.
fn string_to_index<A: IVm>(s: &String<A>) -> Option<u32> {
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

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{naive::Naive, vm::ToAny, vm::ToArray};

    type A = Naive;

    fn array(items: impl IntoIterator<Item = f64>) -> Array<A> {
        items
            .into_iter()
            .map(|n| n.to_any::<A>())
            .collect::<std::vec::Vec<_>>()
            .to_array()
    }

    #[test]
    fn numeric_index_reads_element() {
        let a = array([10.0, 20.0, 30.0]);
        assert_eq!(a.member_access(0.0.to_any()), Some(10.0.to_any()));
        assert_eq!(a.member_access(2.0.to_any()), Some(30.0.to_any()));
    }

    /// A numeric `-0` key stringifies to `"0"` before it is ever used as a
    /// key, in real JS as here, so it reads the same element `0` does —
    /// unlike the *string* key `"-0"`, covered below.
    #[test]
    fn negative_zero_index_reads_first_element() {
        let a = array([10.0]);
        assert_eq!(a.member_access((-0.0f64).to_any()), Some(10.0.to_any()));
    }

    #[test]
    fn out_of_range_numeric_index_is_none() {
        let a = array([10.0]);
        assert_eq!(a.member_access(1.0.to_any()), None);
    }

    #[test]
    fn non_integer_or_negative_numeric_index_is_none() {
        let a = array([10.0]);
        assert_eq!(a.member_access(0.5.to_any()), None);
        assert_eq!(a.member_access((-1.0f64).to_any()), None);
    }

    #[test]
    fn canonical_string_index_reads_element() {
        let a = array([10.0, 20.0]);
        assert_eq!(a.member_access("0".into()), Some(10.0.to_any()));
        assert_eq!(a.member_access("1".into()), Some(20.0.to_any()));
    }

    /// None of these round-trip to themselves through `ToNumber` then
    /// `ToString` the way `"0"`/`"1"`/… do, so none of them is the
    /// canonical form of any index — admitting them would let two
    /// different strings read the same element.
    #[test]
    fn non_canonical_string_index_is_none() {
        let a = array([10.0]);
        for key in ["01", "+0", "1.0", " 0", "-0", ""] {
            assert_eq!(
                a.member_access(key.into()),
                None,
                "key {key:?} must not read an element"
            );
        }
    }

    #[test]
    fn length_key_reads_length() {
        let a = array([10.0, 20.0, 30.0]);
        assert_eq!(a.member_access("length".into()), Some(3.0.to_any()));
    }

    /// `.length` is looked up only through the string key `"length"`; the
    /// number `3` on a 3-element array is a plain out-of-range index, not
    /// a second spelling of `.length`.
    #[test]
    fn length_is_not_reachable_by_number() {
        let a = array([10.0, 20.0, 30.0]);
        assert_eq!(a.member_access(3.0.to_any()), None);
    }

    #[test]
    fn unrelated_key_is_none() {
        let a = array([10.0]);
        assert_eq!(a.member_access(true.to_any()), None);
    }
}
