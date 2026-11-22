use std::collections::{BTreeMap, btree_map::Entry};

use super::Object;
use crate::vm::{IVm, Property, String, member_access::string_to_index};

/// The `u32` value of `k` if ECMAScript's own-property enumeration treats it
/// as an "array index" — the keys `JSON.stringify` (via
/// `[[OwnPropertyKeys]]`) lists first, ascending, ahead of every other key
/// in insertion order: [`string_to_index`]'s canonical index, except
/// `"4294967295"`, the one `ToUint32` value the spec carves out
/// (`ToUint32(key) != 2^32 - 1`).
///
/// [`Object::own_entries`] uses this to sort an object's array-index keys ahead
/// of the rest, by this value rather than by the key's own text — `"10"`
/// sorts after `"2"` numerically, the opposite of their lexicographic order.
fn array_index_value<A: IVm>(k: &String<A>) -> Option<u32> {
    string_to_index(k).filter(|&n| n != u32::MAX)
}

/// The most properties that [`Object::lists_own_entries`] checks in place:
/// it compares each key that is no array index with every key before it,
/// so a larger object takes the copy instead.
const IN_PLACE: u32 = 16;

impl<A: IVm> Object<A> {
    /// Whether the property list, as it was written, already is
    /// [`Object::own_entries`]: each key once, array-index keys first and
    /// ascending, so a read by position or by key reads it in place, with
    /// no copy. `false` where it is not, or where it has more than
    /// [`IN_PLACE`] properties, for the copy. An object built by L0's
    /// `seal` always is.
    ///
    /// ```
    /// use nanvm_lib::{naive::Naive, vm::{Object, ToAny, ToObject}};
    /// let of = |keys: &[&str]| -> Object<Naive> {
    ///     keys.iter().map(|k| ((*k).into(), true.to_any())).collect::<Vec<_>>().to_object()
    /// };
    /// assert!(of(&["1", "2", "b", "a"]).lists_own_entries());
    /// assert!(!of(&["2", "1"]).lists_own_entries());
    /// assert!(!of(&["b", "1"]).lists_own_entries());
    /// assert!(!of(&["b", "a", "b"]).lists_own_entries());
    /// assert!(!of(&["1", "1"]).lists_own_entries());
    /// ```
    pub fn lists_own_entries(&self) -> bool {
        let n = self.length();
        if n > IN_PLACE {
            return false;
        }
        let mut last: Option<u32> = None;
        let mut other = false;
        for i in 0..n {
            let k = self.key_at(i);
            match array_index_value(&k) {
                Some(v) => {
                    if other || last.is_some_and(|l| l >= v) {
                        return false;
                    }
                    last = Some(v);
                }
                None => {
                    if (0..i).any(|j| self.key_at(j) == k) {
                        return false;
                    }
                    other = true;
                }
            }
        }
        true
    }

    /// The own enumerable string-keyed entries, as `[[OwnPropertyKeys]]`
    /// lists them: each key once, holding its *last* value at its *first*
    /// position, array-index keys first, ascending by value, then every
    /// other key in insertion order. The one view `JSON.stringify` writes
    /// and an object spread copies (`Any::to_json`, `Any::object_spread`),
    /// so the two cannot disagree on order.
    ///
    /// An object's property list is never deduplicated on construction
    /// ([`Object::own_property`]'s doc comment), so one pass over it keeps
    /// each key's first position and overwrites its value on every later
    /// write, finding the key's slot through a map ordered by
    /// [`String`]'s `Ord`: `O(n log n)` in the number of properties, where a
    /// scan per key would be quadratic.
    ///
    /// ```
    /// use nanvm_lib::{naive::Naive, vm::{Any, IVm, Object, String, ToAny, ToObject}};
    /// fn own_entries_test<A: IVm>() {
    ///     let o: Object<A> = [
    ///         ("b".into(), true.to_any()),
    ///         ("1".into(), true.to_any()),
    ///         ("b".into(), false.to_any()),
    ///     ].to_object();
    ///     let keys: Vec<String<A>> = o.own_entries().into_iter().map(|(k, _)| k).collect();
    ///     assert_eq!(keys, [String::from("1"), String::from("b")]);
    /// }
    /// own_entries_test::<Naive>();
    /// ```
    pub fn own_entries(&self) -> Vec<Property<A>> {
        let mut slots: BTreeMap<String<A>, usize> = BTreeMap::new();
        let mut entries: Vec<Property<A>> = Vec::new();
        for i in 0..self.length() {
            let (k, v) = self.property_at(i);
            match slots.entry(k.clone()) {
                Entry::Occupied(slot) => entries[*slot.get()].1 = v,
                Entry::Vacant(slot) => {
                    slot.insert(entries.len());
                    entries.push((k, v));
                }
            }
        }
        let mut index_entries: Vec<(u32, Property<A>)> = Vec::new();
        let mut other_entries: Vec<Property<A>> = Vec::new();
        for (k, v) in entries {
            match array_index_value(&k) {
                Some(n) => index_entries.push((n, (k, v))),
                None => other_entries.push((k, v)),
            }
        }
        index_entries.sort_by_key(|(n, _)| *n);
        index_entries
            .into_iter()
            .map(|(_, entry)| entry)
            .chain(other_entries)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::array_index_value;
    use crate::{
        naive::Naive,
        vm::{Object, String, ToAny, ToObject, member_access::string_to_index},
    };

    /// `array_index_value` is `string_to_index` but for one key,
    /// `"4294967295"`: an element read's index, never an own-key ordering's.
    #[test]
    fn array_index_value_is_string_to_index_but_for_u32_max() {
        let long = "1".repeat(40);
        let cases: [(&str, Option<u32>); 14] = [
            ("", None),
            ("0", Some(0)),
            ("00", None),
            ("01", None),
            ("7", Some(7)),
            ("10", Some(10)),
            ("a", None),
            ("1a", None),
            ("\u{0661}", None),
            ("\u{FF11}", None),
            ("4294967294", Some(u32::MAX - 1)),
            ("4294967295", None),
            ("4294967296", None),
            (long.as_str(), None),
        ];
        for (key, expected) in cases {
            let k: String<Naive> = key.into();
            assert_eq!(array_index_value(&k), expected, "{key:?}");
            let scanned = if key == "4294967295" {
                Some(u32::MAX)
            } else {
                expected
            };
            assert_eq!(string_to_index(&k), scanned, "{key:?}");
        }
    }

    const SIZE: u32 = 100_000;

    fn key(i: u32) -> String<Naive> {
        format!("k{i}").as_str().into()
    }

    /// A size where a scan per key, quadratic, ran for seconds: one pass
    /// keeps every key, in insertion order.
    #[test]
    fn many_distinct_keys() {
        let o: Object<Naive> = (0..SIZE)
            .map(|i| (key(i), f64::from(i).to_any()))
            .to_object();
        let entries = o.own_entries();
        assert_eq!(entries.len(), SIZE as usize);
        for (i, (k, v)) in (0..SIZE).zip(entries) {
            assert_eq!(k, key(i));
            assert_eq!(v, f64::from(i).to_any());
        }
    }

    /// Every key written twice, the whole list over again: each key once,
    /// at its first position, holding the second write.
    #[test]
    fn many_repeated_keys() {
        let o: Object<Naive> = (0..2 * SIZE)
            .map(|i| (key(i % SIZE), f64::from(i).to_any()))
            .to_object();
        let entries = o.own_entries();
        assert_eq!(entries.len(), SIZE as usize);
        for (i, (k, v)) in (0..SIZE).zip(entries) {
            assert_eq!(k, key(i));
            assert_eq!(v, f64::from(SIZE + i).to_any());
        }
    }
}
