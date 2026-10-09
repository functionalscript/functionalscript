#![doc = include_str!("README.md")]

use crate::{
    sign::Sign,
    vm::{
        Any, BigInt, IVm, IteratorRecord, Number, String, ToAny, ToArray, ToObject, ToString, error,
    },
};

/// An `Any` holding the string `v`.
pub fn string_any<A: IVm>(v: &str) -> Any<A> {
    v.into()
}

/// An object property key.
pub fn string_key<A: IVm>(v: &str) -> String<A> {
    v.into()
}

/// An `Any` holding the string of UTF-16 code units `v`: the spelling of a
/// string no `&str` can hold, one with a lone surrogate.
pub fn string_any_utf16<A: IVm>(v: &[u16]) -> Any<A> {
    string_key_utf16::<A>(v).to_any()
}

/// An object property key of UTF-16 code units, for the same reason.
pub fn string_key_utf16<A: IVm>(v: &[u16]) -> String<A> {
    v.iter().copied().to_string()
}

/// An `Any` holding the bigint `v`.
pub fn bigint_any<A: IVm>(v: i64) -> Any<A> {
    Into::<BigInt<A>>::into(v).to_any()
}

/// An `Any` holding the bigint of any size whose magnitude is `words`, least
/// significant word first, negated if `negative`: the spelling of a literal
/// outside `i64`, which [`bigint_any`] cannot take. A zero magnitude is `0n`
/// whatever the sign, and leading zero words are dropped.
pub fn bigint_any_words<A: IVm>(negative: bool, words: &[u64]) -> Any<A> {
    let sign = if negative {
        Sign::Negative
    } else {
        Sign::Positive
    };
    BigInt::normalize_new(sign, words.iter().copied()).to_any()
}

/// An `Any` holding the number whose IEEE 754 bits are `v` — the one
/// spelling `fjs/media/rust` gives every number, so a generated module holds
/// the double a JavaScript engine held, bit for bit, `-0` included, except a
/// `NaN`: the language has one, so every `NaN` arrives as the quiet,
/// empty-payload one, whatever sign or payload the engine held it with.
pub fn f64_any<A: IVm>(v: u64) -> Any<A> {
    Number::from(f64::from_bits(v)).to_any()
}

/// `===` as an operator result. `==` on `Any` is exactly JavaScript's `===`,
/// but it yields a `bool` and so pins neither operand's `A`; this gives both
/// the same one and lifts the answer into the `Result` every other operator
/// returns, so a printed `===` is a statement like any other operator's.
pub fn strict_eq<A: IVm>(a: Any<A>, b: Any<A>) -> Result<Any<A>, Any<A>> {
    Ok((a == b).to_any())
}

/// `!==`, the negation of [`strict_eq`], for the same reason.
pub fn strict_ne<A: IVm>(a: Any<A>, b: Any<A>) -> Result<Any<A>, Any<A>> {
    Ok((a != b).to_any())
}

/// `Object.is` as an operator result: [`Any::same_value`], lifted into the
/// `Result` every other operator returns, as [`strict_eq`] lifts `===`.
pub fn object_is<A: IVm>(a: Any<A>, b: Any<A>) -> Result<Any<A>, Any<A>> {
    Ok(a.same_value(&b).to_any())
}

/// One item of an array literal or a call's argument list, as
/// [`spread_array`] and [`spread_call`] read it: a value, or a spread whose
/// values the iterable gives ([`Any::get_iterator`]).
pub enum ArrayItem<A: IVm> {
    Value(Any<A>),
    Spread(Any<A>),
}

/// An item that is its own value, `a` in `[a, ...b]`.
pub fn value_item<A: IVm>(v: Any<A>) -> ArrayItem<A> {
    ArrayItem::Value(v)
}

/// A spread item, `...b` in `[a, ...b]`.
pub fn spread_item<A: IVm>(v: Any<A>) -> ArrayItem<A> {
    ArrayItem::Spread(v)
}

/// An item of [`spread_array`] after its spreads' iterators are taken.
enum Part<A: IVm> {
    One(Any<A>),
    Many(IteratorRecord<A>),
}

/// The array an item list holds, a spread among them: each value an
/// element, and each spread every value its operand iterates, in order. A
/// spread of a value that is not iterable throws, so the array is an
/// operation's `Result` where an array without a spread is a value.
///
/// Every spread's iterator is taken first, and the array's length is
/// bounded before anything is built: past JavaScript's limit, `2³² − 1`
/// elements and `Array<A>`'s `u32` length, the result is the `RangeError`
/// `ArrayCreate` throws, refused on the iterators' lower bounds — exact for
/// an array — and, since a string's code points are only known by walking
/// it, checked again as each element is added, so the build never passes
/// the limit. Taking the iterators first is unobservable: neither an array
/// nor a string runs code while iterated.
pub fn spread_array<A: IVm>(
    items: impl IntoIterator<Item = ArrayItem<A>>,
) -> Result<Any<A>, Any<A>> {
    let parts = items
        .into_iter()
        .map(|item| match item {
            ArrayItem::Value(v) => Ok(Part::One(v)),
            ArrayItem::Spread(v) => v.get_iterator().map(Part::Many),
        })
        .collect::<Result<Vec<_>, _>>()?;
    let at_least: u64 = parts
        .iter()
        .map(|p| match p {
            Part::One(_) => 1,
            Part::Many(i) => i.size_hint().0 as u64,
        })
        .sum();
    let limit = u64::from(u32::MAX);
    if at_least > limit {
        return Err(error::array_too_long());
    }
    let mut values = Vec::with_capacity(at_least as usize);
    let mut push = |v: Any<A>| -> Result<(), Any<A>> {
        if values.len() as u64 == limit {
            return Err(error::array_too_long());
        }
        values.push(v);
        Ok(())
    };
    for part in parts {
        match part {
            Part::One(v) => push(v)?,
            Part::Many(i) => i.into_iter().try_for_each(&mut push)?,
        }
    }
    Ok(values.to_array().to_any())
}

/// `f(...)` over an argument list holding a spread: the arguments
/// [`spread_array`] builds, then the call, so a spread's throw comes first,
/// as JavaScript evaluates the arguments before it calls.
pub fn spread_call<A: IVm>(
    f: Any<A>,
    items: impl IntoIterator<Item = ArrayItem<A>>,
) -> Result<Any<A>, Any<A>> {
    f.call(spread_array(items)?)
}

/// One entry of an object literal, as [`spread_object`] reads it: a
/// property, a key and its value, or a spread whose entries the value
/// gives ([`Any::object_spread`]).
pub enum ObjectItem<A: IVm> {
    Property(String<A>, Any<A>),
    Spread(Any<A>),
}

/// A property entry, `k: v` in `{k: v, ...o}`.
pub fn property_item<A: IVm>(k: String<A>, v: Any<A>) -> ObjectItem<A> {
    ObjectItem::Property(k, v)
}

/// A computed property entry, `[k]: v`: [`Any::to_string`] supplies
/// `ToPropertyKey` for the VM's values, which do not include symbols.
/// A plain object becomes `"[object Object]"`; an own callable `toString`
/// is called, with `valueOf` as the fallback if it returns no primitive.
/// Conversion errors propagate: `{ toString: 0 }`, for example, cannot
/// produce a primitive and is refused. The only fallible entry, so the
/// one that is a `Result`.
pub fn computed_item<A: IVm>(k: Any<A>, v: Any<A>) -> Result<ObjectItem<A>, Any<A>> {
    Ok(ObjectItem::Property(k.to_string()?, v))
}

/// A spread entry, `...o` in `{k: v, ...o}`.
pub fn spread_entries<A: IVm>(v: Any<A>) -> ObjectItem<A> {
    ObjectItem::Spread(v)
}

/// The object an entry list holds, a spread among them: each property and
/// each spread's entries appended in order to the raw property list, so a
/// later key overwrites an earlier one's value and keeps its position, as
/// JavaScript's does, through the view every reader takes
/// ([`Object::own_entries`](crate::vm::Object::own_entries)). An object
/// spread never throws, so this is a value, not a `Result`.
pub fn spread_object<A: IVm>(items: impl IntoIterator<Item = ObjectItem<A>>) -> Any<A> {
    let mut entries = Vec::new();
    for item in items {
        match item {
            ObjectItem::Property(k, v) => entries.push((k, v)),
            ObjectItem::Spread(v) => entries.extend(v.object_spread()),
        }
    }
    entries.to_object().to_any()
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{
        common::sized_index::SizedIndex,
        naive::Naive,
        vm::{Array, IStaticFunction, Object, Unpacked},
    };

    #[test]
    fn strings() {
        let direct: Any<Naive> = "a".into();
        assert_eq!(string_any::<Naive>("a"), direct);
        let key: String<Naive> = "a".into();
        assert_eq!(string_key::<Naive>("a"), key);
    }

    #[test]
    fn bigints() {
        assert_eq!(
            bigint_any::<Naive>(-1),
            Into::<BigInt<Naive>>::into(-1i64).to_any()
        );
    }

    #[test]
    fn bigints_of_any_size() {
        let word = |negative, words: &[u64]| bigint_any_words::<Naive>(negative, words);
        // Within `i64` it agrees with `bigint_any`, `i64::MIN` included.
        assert_eq!(word(false, &[1]), bigint_any(1));
        assert_eq!(word(true, &[1 << 63]), bigint_any(i64::MIN));
        assert_eq!(word(false, &[i64::MAX as u64]), bigint_any(i64::MAX));
        // Zero is `0n`, signed or padded.
        assert_eq!(word(true, &[]), bigint_any(0));
        assert_eq!(word(true, &[0, 0]), bigint_any(0));
        // A word boundary: `2n ** 64n`, and its negation.
        let two_64 = word(false, &[0, 1]);
        assert_eq!(two_64, (bigint_any::<Naive>(1) << bigint_any(64)).unwrap());
        assert_eq!(word(true, &[0, 1, 0]), (-two_64.clone()).unwrap());
        assert_ne!(two_64, word(false, &[1, 1]));
        // Several words, as the decimal `123456789012345678901234567890n`.
        let big = word(false, &[0xC373E0EE4E3F0AD2, 0x18EE90FF6]);
        assert_eq!(
            big.to_string().unwrap(),
            "123456789012345678901234567890".into()
        );
    }

    #[test]
    fn numbers_by_their_bits() {
        let bits = |v: Any<Naive>| match v.into() {
            Unpacked::Number(x) => f64::from(x).to_bits(),
            _ => panic!("a number"),
        };
        assert_eq!(bits(f64_any(0x4002666666666666)), 2.3f64.to_bits());
        assert_eq!(bits(f64_any(0x8000000000000000)), (-0f64).to_bits());
        assert_eq!(bits(f64_any(0x7ff8000000000000)), 0x7ff8000000000000);
    }

    /// The two answer each other's negation, `NaN` against itself included:
    /// `NaN === NaN` is `false` and `NaN !== NaN` is `true`, as in JavaScript.
    #[test]
    fn strict_equality() {
        let one = || f64_any::<Naive>(0x3ff0000000000000);
        let nan = || f64_any::<Naive>(0x7ff8000000000000);
        assert_eq!(strict_eq(one(), one()), Ok(true.to_any()));
        assert_eq!(strict_ne(one(), one()), Ok(false.to_any()));
        assert_eq!(strict_eq(nan(), nan()), Ok(false.to_any()));
        assert_eq!(strict_ne(nan(), nan()), Ok(true.to_any()));
        assert_eq!(strict_eq(one(), string_any("1")), Ok(false.to_any()));
    }

    /// `Object.is` tells `NaN` from itself no more than `===` does not, and `0`
    /// from `-0`.
    #[test]
    fn same_value_equality() {
        let nan = || f64_any::<Naive>(0x7ff8000000000000);
        let zero = || f64_any::<Naive>(0);
        let negative_zero = || f64_any::<Naive>(0x8000000000000000);
        assert_eq!(object_is(nan(), nan()), Ok(true.to_any()));
        assert_eq!(object_is(zero(), negative_zero()), Ok(false.to_any()));
        assert_eq!(object_is(zero(), zero()), Ok(true.to_any()));
        assert_eq!(object_is(zero(), string_any("0")), Ok(false.to_any()));
    }

    /// The elements of an array result, compared by value: `==` on two
    /// arrays is `===`, identity.
    fn elements(r: Result<Any<Naive>, Any<Naive>>) -> Vec<Any<Naive>> {
        Array::try_from(r.unwrap()).unwrap().into_iter().collect()
    }

    /// `[1, ...'ab', ...[2]]` is `[1, 'a', 'b', 2]`, an empty spread adds
    /// nothing, and a spread of what is not iterable throws.
    #[test]
    fn spread_arrays() {
        let one = || f64_any::<Naive>(0x3ff0000000000000);
        let two = || f64_any::<Naive>(0x4000000000000000);
        let inner: Any<Naive> = [two()].to_array().to_any();
        assert_eq!(
            elements(spread_array([
                value_item(one()),
                spread_item(string_any("ab")),
                spread_item(inner),
            ])),
            [one(), string_any("a"), string_any("b"), two()]
        );
        let empty: Any<Naive> = [].to_array().to_any();
        assert!(
            elements(spread_array([
                spread_item(string_any("")),
                spread_item(empty)
            ]))
            .is_empty()
        );
        assert!(spread_array([value_item(one()), spread_item(one())]).is_err());
    }

    /// Past `2³² − 1` elements the result is the `RangeError`, refused on
    /// the iterators' exact lengths before anything is allocated: 65,537
    /// spreads of one 65,536-element array would be 2³² + 2¹⁶ elements.
    #[test]
    fn spread_array_too_long() {
        let one = || f64_any::<Naive>(0x3ff0000000000000);
        let block: Any<Naive> = (0..65536)
            .map(|_| one())
            .collect::<Vec<_>>()
            .to_array()
            .to_any();
        let too_many = (0..65537).map(|_| spread_item(block.clone()));
        assert_eq!(spread_array(too_many).err(), Some(error::array_too_long()));
        let within = (0..2).map(|_| spread_item(block.clone()));
        assert_eq!(elements(spread_array(within)).len(), 131072);
    }

    /// The callee receives the spread values as its arguments, and a spread
    /// that throws throws before the call, a callee that is not a function
    /// included.
    #[test]
    fn spread_calls() {
        use crate::vm::IStaticFunction;
        let identity: Any<Naive> =
            Naive::static_function(|_, args| Ok(args.to_any()), 0, [].to_array(), None).to_any();
        assert_eq!(
            elements(spread_call(identity, [spread_item(string_any("ab"))])),
            [string_any("a"), string_any("b")]
        );
        let one = || f64_any::<Naive>(0x3ff0000000000000);
        assert!(spread_call(one(), [spread_item(one())]).is_err());
    }

    /// `{a: 1, ...{b: 2, a: 3}, ...'x'}` is `{0: 'x', a: 3, b: 2}`: the
    /// spread's `a` overwrites the first one's value and keeps its
    /// position, and the index key comes first; `{...null}` adds nothing.
    #[test]
    fn spread_objects() {
        use crate::vm::{Nullish, Object, ToObject};
        let one = || f64_any::<Naive>(0x3ff0000000000000);
        let two = || f64_any::<Naive>(0x4000000000000000);
        let three = || f64_any::<Naive>(0x4008000000000000);
        let inner: Any<Naive> = [(string_key("b"), two()), (string_key("a"), three())]
            .to_object()
            .to_any();
        let result = spread_object([
            property_item(string_key("a"), one()),
            spread_entries(inner),
            spread_entries(string_any("x")),
            spread_entries(Nullish::Null.to_any()),
        ]);
        let entries = Object::try_from(result).unwrap().own_entries();
        assert_eq!(
            entries,
            [
                (string_key("0"), string_any("x")),
                (string_key("a"), three()),
                (string_key("b"), two()),
            ]
        );
    }

    /// A computed key is its `ToString`, as an own key: a number is its
    /// text and `-0` is `"0"`; a key that cannot be converted throws before
    /// the entry exists.
    #[test]
    fn computed_keys() {
        let one = || f64_any::<Naive>(0x3ff0000000000000);
        let negative_zero = || f64_any::<Naive>(0x8000000000000000);
        let object = spread_object([
            computed_item(one(), string_any("a")).unwrap(),
            computed_item(negative_zero(), string_any("b")).unwrap(),
            computed_item(Any::undefined(), string_any("c")).unwrap(),
            computed_item(string_any("1"), string_any("d")).unwrap(),
        ]);
        let entries = Object::try_from(object).unwrap().own_entries();
        assert_eq!(
            entries,
            [
                (string_key("0"), string_any("b")),
                (string_key("1"), string_any("d")),
                (string_key("undefined"), string_any("c")),
            ]
        );
        let plain = Object::<Naive>::default().to_any();
        let item = computed_item(plain, one()).unwrap();
        let ObjectItem::Property(key, _) = item else {
            panic!()
        };
        assert_eq!(key, string_key("[object Object]"));
    }

    /// An own conversion method supplies the key, and its errors propagate.
    #[test]
    fn computed_key_conversion() {
        let with_to_string = |method: Any<Naive>| -> Any<Naive> {
            [(string_key("toString"), method)].to_object().to_any()
        };
        let method =
            Naive::static_function(|_, _| Ok(string_any("own")), 0, [].to_array(), None).to_any();
        let item = computed_item(with_to_string(method), string_any("value")).unwrap();
        let object = Object::try_from(spread_object([item])).unwrap();
        assert_eq!(
            object.own_entries(),
            [(string_key("own"), string_any("value"))]
        );

        let method = Naive::static_function(
            |_, _| Err(string_any("key conversion failed")),
            0,
            [].to_array(),
            None,
        )
        .to_any();
        assert!(matches!(
            computed_item(with_to_string(method), string_any("value")),
            Err(error) if error == string_any("key conversion failed")
        ));
        assert!(computed_item(with_to_string(f64_any(0)), string_any("value")).is_err());
    }

    /// A string of code units holds what no `&str` can, a lone surrogate,
    /// and agrees with the `&str` spelling where both exist.
    #[test]
    fn strings_of_code_units() {
        let lone = string_key_utf16::<Naive>(&[0x61, 0xd800]);
        assert_eq!(lone.length(), 2);
        assert_eq!(lone[1], 0xd800);
        assert_eq!(string_any_utf16::<Naive>(&[0x61, 0x62]), string_any("ab"));
        assert_eq!(string_key_utf16::<Naive>(&[]), string_key(""));
    }
}
