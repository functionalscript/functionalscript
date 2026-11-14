//! The reference map, native: what a compiled module's `empty` of
//! `fjs/types/ref_map` is on this VM. A map is a function whose frame holds
//! its entries in a trie over each key's address, so a call takes a number
//! of steps bounded by the address's width, and `O(log n)` of them for `n`
//! keys spread as addresses are. A map keeps its keys alive, so no address
//! is another key's while it is in a map.

use crate::vm::{Any, Array, Function, IFunction, IVm, ToAny, ToArray, Unpacked, error};

/// The number of a key's identity: an object's, an array's or a function's.
/// A primitive has none, and is never a key.
fn address<A: IVm>(key: &Any<A>) -> Option<usize> {
    key.with_unpacked(|v| match v {
        Unpacked::Object(v) => Some(v.address()),
        Unpacked::Array(v) => Some(v.address()),
        Unpacked::Function(v) => Some(v.address()),
        _ => None,
    })
}

/// The path of a key: its address multiplied by an odd number, read from
/// the high bit down. Allocations are aligned, so the low bits of addresses
/// agree, and the low bits of the product agree with them; the high bits
/// take in every bit of the address, so paths part early. The
/// multiplication loses nothing, so two addresses never share a whole path.
fn path(address: usize) -> u64 {
    (address as u64).wrapping_mul(0x9e37_79b9_7f4a_7c15)
}

/// A node, `[key, value, zero, one]`, or `None` where the trie ends.
fn node<A: IVm>(v: &Any<A>) -> Option<Array<A>> {
    v.with_unpacked(|v| match v {
        Unpacked::Array(v) => Some(v.clone()),
        _ => None,
    })
}

/// Which child a path takes next, by its high bit: `zero`, at `2`, or
/// `one`, at `3`.
fn child(path: u64) -> u32 {
    if path >> 63 == 0 { 2 } else { 3 }
}

/// The value `key` has under `root`, or `undefined`.
fn find<A: IVm>(root: &Any<A>, mut path: u64, key: &Any<A>) -> Any<A> {
    let mut current = node(root);
    while let Some(n) = current {
        if n[0] == *key {
            return n[1].clone();
        }
        current = node(&n[child(path)]);
        path <<= 1;
    }
    Any::undefined()
}

/// The trie under `root` with `key` set to `value`: the nodes on the key's
/// path made anew, the rest shared.
fn set<A: IVm>(root: &Any<A>, path: u64, key: &Any<A>, value: &Any<A>) -> Any<A> {
    let Some(n) = node(root) else {
        return [
            key.clone(),
            value.clone(),
            Any::undefined(),
            Any::undefined(),
        ]
        .to_array()
        .to_any();
    };
    if n[0] == *key {
        return [key.clone(), value.clone(), n[2].clone(), n[3].clone()]
            .to_array()
            .to_any();
    }
    let next = set(&n[child(path)], path << 1, key, value);
    if child(path) == 2 {
        [n[0].clone(), n[1].clone(), next, n[3].clone()]
    } else {
        [n[0].clone(), n[1].clone(), n[2].clone(), next]
    }
    .to_array()
    .to_any()
}

/// A map's call: the value `key` has, and the same map for a read, or a
/// new map with the key set. A `value` of `undefined` is a read. A
/// primitive key reads as `undefined`, and setting one fails.
fn call<A: IVm>(self_: &A::InternalFunction, args: Array<A>) -> Result<Any<A>, Any<A>> {
    let root = &A::frame(self_)[0];
    let key = args.argument(0);
    let value = args.argument(1);
    let path = address(&key).map(path);
    let old = path.map_or_else(Any::undefined, |path| find(root, path, &key));
    if value.with_unpacked(Unpacked::is_undefined) {
        return Ok([old, Function::<A>::new(self_.clone()).to_any()]
            .to_array()
            .to_any());
    }
    let path = path.ok_or_else(error::reference_map_key)?;
    Ok([old, map(set(root, path, &key, &value), self_.text())]
        .to_array()
        .to_any())
}

/// The map whose trie is `root`.
fn map<A: IVm>(root: Any<A>, text: Option<&'static str>) -> Any<A> {
    A::static_function(call::<A>, 2, [root].to_array(), text).to_any()
}

/// A new empty reference map: what a compiled module spells where the
/// EDAG's `['refMap']` is established, a function of its own each time,
/// as a closure is. `text` is the map's text, which every map made from
/// this one answers `String(m)` with.
pub fn ref_map<A: IVm>(text: Option<&'static str>) -> Any<A> {
    map(Any::undefined(), text)
}

#[cfg(test)]
mod test {
    use super::ref_map;
    use crate::{
        naive::Naive,
        vm::{Any, Array, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    fn object() -> Any<A> {
        [("x".into(), 1.0.to_any())].to_object().to_any()
    }

    /// `m(key)` or `m(key, value)`, as its pair.
    fn call(m: &Any<A>, args: impl IntoIterator<Item = Any<A>>) -> [Any<A>; 2] {
        let pair: Array<A> = m
            .clone()
            .call(args.into_iter().collect::<Vec<_>>().to_array().to_any())
            .unwrap()
            .try_into()
            .unwrap();
        pair.try_into().ok().unwrap()
    }

    fn get(m: &Any<A>, key: &Any<A>) -> Any<A> {
        let [value, same] = call(m, [key.clone()]);
        assert!(same == *m);
        value
    }

    fn put(m: &Any<A>, key: &Any<A>, value: Any<A>) -> Any<A> {
        let [_, next] = call(m, [key.clone(), value]);
        next
    }

    /// A read answers the key's value and the same map, the empty map
    /// included; a set answers the value the key had and a new map, and
    /// leaves the old one as it was.
    #[test]
    fn read_and_set() {
        let empty = ref_map::<A>(None);
        let key = object();
        assert!(get(&empty, &key) == Any::undefined());
        let [previous, one] = call(&empty, [key.clone(), 1.0.to_any()]);
        assert!(previous == Any::undefined());
        assert!(one != empty);
        assert!(get(&one, &key) == 1.0.to_any());
        assert!(get(&empty, &key) == Any::undefined());
        let [old, two] = call(&one, [key.clone(), 2.0.to_any()]);
        assert!(old == 1.0.to_any());
        assert!(get(&two, &key) == 2.0.to_any());
        assert!(get(&one, &key) == 1.0.to_any());
        // a value of `undefined` is a read
        let [value, same] = call(&two, [key.clone(), Any::undefined()]);
        assert!(value == 2.0.to_any());
        assert!(same == two);
    }

    /// Keys are references: a clone is the same key, another object alike
    /// is another, and an array, a function and a map are keys.
    #[test]
    fn keys() {
        let a = object();
        let alike = object();
        let list: Any<A> = [1.0.to_any()].to_array().to_any();
        let function = ref_map::<A>(None);
        let mut m = ref_map::<A>(None);
        for (key, value) in [
            (&a, "a"),
            (&alike, "alike"),
            (&list, "list"),
            (&function, "f"),
        ] {
            m = put(&m, key, value.into());
        }
        assert!(get(&m, &a.clone()) == "a".into());
        assert!(get(&m, &alike) == "alike".into());
        assert!(get(&m, &list) == "list".into());
        assert!(get(&m, &function) == "f".into());
        assert!(get(&m, &object()) == Any::undefined());
        assert!(get(&m, &m) == Any::undefined());
    }

    /// A primitive is never a key: reading one answers `undefined`, and
    /// setting one fails.
    #[test]
    fn primitive_keys() {
        let m = put(&ref_map::<A>(None), &object(), 1.0.to_any());
        for key in [
            Any::<A>::undefined(),
            1.0.to_any(),
            "k".into(),
            true.to_any(),
        ] {
            assert!(get(&m, &key) == Any::undefined());
            let args = [key, 1.0.to_any()].to_array().to_any();
            assert!(m.clone().call(args).is_err());
        }
    }

    /// Many keys, each found again, in an older map as in the newest; two
    /// maps from two empty ones hold the same key apart.
    #[test]
    fn many() {
        let keys: Vec<Any<A>> = (0..2_000).map(|_| object()).collect();
        let mut maps = [ref_map::<A>(None)].to_vec();
        for (i, key) in keys.iter().enumerate() {
            let next = put(&maps[i], key, (i as f64).to_any());
            maps.push(next);
        }
        for (i, key) in keys.iter().enumerate() {
            assert!(get(&maps[keys.len()], key) == (i as f64).to_any());
            // the map made just before this key was set has none for it
            assert!(get(&maps[i], key) == Any::undefined());
            assert!(get(&maps[i + 1], key) == (i as f64).to_any());
        }
        let other = put(&ref_map::<A>(None), &keys[0], "other".into());
        assert!(get(&other, &keys[0]) == "other".into());
        assert!(get(&maps[1], &keys[0]) == 0.0.to_any());
    }

    /// A map has the `length` of its two parameters and the text it was
    /// made with, which the maps made from it keep.
    #[test]
    fn length_and_text() {
        let empty = ref_map::<A>(Some("map"));
        let next = put(&empty, &object(), 1.0.to_any());
        for m in [empty, next] {
            let f: crate::vm::Function<A> = m.try_into().unwrap();
            assert_eq!(f.length(), 2);
            assert!(f.text().unwrap() == "map".into());
        }
        let bare: crate::vm::Function<A> = ref_map::<A>(None).try_into().unwrap();
        assert!(bare.text().is_err());
    }
}
