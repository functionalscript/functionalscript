use core::iter::FusedIterator;

use crate::{
    common::sized_index::SizedIndex,
    vm::{
        Any, Array, IVm, String, ToAny, ToString,
        string::code_unit::{is_high_surrogate, is_low_surrogate},
    },
};

/// What [`Any::get_iterator`] returns: the values an iterable yields, one at
/// a time, after ECMAScript's Iterator Record. The spec's record also holds
/// a `next` method and a `[[Done]]` flag; this one is a Rust [`Iterator`]
/// and needs neither.
///
/// A Rust type, never a VM value: a FunctionalScript module cannot spell an
/// iterator, so one exists only between `get_iterator` and the container
/// being built, and nothing can observe its state or advance it twice.
///
/// Each variant owns its value — a reference count, not a copy — and the
/// position of the next value. Stepping cannot fail, so the items are
/// values, not `Result`s: only `get_iterator` itself throws.
///
/// ```
/// use nanvm_lib::{vm::{Any, IVm, Number, ToAny, ToArray}, naive::Naive};
/// fn spread<A: IVm>() {
///     let a: Any<A> = [Any::from("x"), Any::from("y")].to_array().to_any();
///     assert_eq!(a.get_iterator().unwrap().count(), 2);
///     let s: Any<A> = "a😀".into();
///     assert_eq!(s.get_iterator().unwrap().count(), 2);
///     let n: Any<A> = Number::from(1.0).to_any();
///     assert!(n.get_iterator().is_err());
/// }
/// spread::<Naive>();
/// ```
pub enum IteratorRecord<A: IVm> {
    /// An array's elements, in index order.
    Array { array: Array<A>, next: u32 },
    /// A string's code points, each a string of its own; `next` is a code
    /// unit index.
    String { string: String<A>, next: u32 },
}

impl<A: IVm> Iterator for IteratorRecord<A> {
    type Item = Any<A>;

    fn next(&mut self) -> Option<Any<A>> {
        match self {
            IteratorRecord::Array { array, next } => {
                if *next >= array.length() {
                    return None;
                }
                let value = array[*next].clone();
                *next += 1;
                Some(value)
            }
            IteratorRecord::String { string, next } => {
                let length = string.length();
                if *next >= length {
                    return None;
                }
                let first = string[*next];
                let pair = is_high_surrogate(first)
                    && *next + 1 < length
                    && is_low_surrogate(string[*next + 1]);
                let code_point: String<A> = if pair {
                    [first, string[*next + 1]].to_string()
                } else {
                    [first].to_string()
                };
                *next += if pair { 2 } else { 1 };
                Some(code_point.to_any())
            }
        }
    }

    /// Exact for an array. For a string, the code points left are at least
    /// half its code units left, rounded up, and at most all of them. The
    /// upper bound counts code units, so it may exceed what a builder
    /// accepts where the code points produced do not: a builder may reject
    /// early only on the lower bound.
    fn size_hint(&self) -> (usize, Option<usize>) {
        match self {
            IteratorRecord::Array { array, next } => {
                let left = array.length().saturating_sub(*next) as usize;
                (left, Some(left))
            }
            IteratorRecord::String { string, next } => {
                let left = string.length().saturating_sub(*next) as usize;
                (left.div_ceil(2), Some(left))
            }
        }
    }
}

impl<A: IVm> FusedIterator for IteratorRecord<A> {}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, String, ToAny, ToArray, ToString},
    };

    type A = Naive;

    fn n(x: f64) -> Any<A> {
        x.to_any()
    }

    fn s(x: &str) -> Any<A> {
        x.into()
    }

    /// A string of exactly these code units, a lone surrogate included.
    fn units(u: &[u16]) -> Any<A> {
        let s: String<A> = u.iter().copied().to_string();
        s.to_any()
    }

    fn array(items: &[Any<A>]) -> Any<A> {
        items.to_vec().to_array().to_any()
    }

    /// Every value an iterator yields, after `get_iterator` of `v`.
    fn spread(v: Any<A>) -> Vec<Any<A>> {
        v.get_iterator().unwrap().collect()
    }

    #[test]
    fn array_elements_in_order() {
        let items = [n(1.0), s("b"), array(&[])];
        assert_eq!(spread(array(&items)), items);
        assert!(spread(array(&[])).is_empty());
    }

    /// `[...'😀']` is one element of two code units, and `[...'ab']` two.
    #[test]
    fn string_code_points() {
        assert_eq!(spread(s("ab")), [s("a"), s("b")]);
        assert_eq!(spread(s("😀")), [s("😀")]);
        assert_eq!(spread(s("a😀b")), [s("a"), s("😀"), s("b")]);
        assert!(spread(s("")).is_empty());
    }

    /// A lone surrogate is a code point of its own, high or low, and a high
    /// one at the end, or before anything but a low one, has no pair.
    #[test]
    fn lone_surrogates() {
        assert_eq!(
            spread(units(&[0xDE00, 0xD83D])),
            [units(&[0xDE00]), units(&[0xD83D])]
        );
        assert_eq!(spread(units(&[0xD83D, 0x61])), [units(&[0xD83D]), s("a")]);
    }

    #[test]
    fn size_hints() {
        let mut a = array(&[n(1.0), n(2.0)]).get_iterator().unwrap();
        assert_eq!(a.size_hint(), (2, Some(2)));
        a.next();
        assert_eq!(a.size_hint(), (1, Some(1)));
        let mut t = s("a😀").get_iterator().unwrap();
        assert_eq!(t.size_hint(), (2, Some(3)));
        t.next();
        assert_eq!(t.size_hint(), (1, Some(2)));
        t.next();
        assert_eq!(t.size_hint(), (0, Some(0)));
    }

    /// Fused: past the end, `next` keeps answering `None`.
    #[test]
    fn fused() {
        for v in [s("a"), array(&[n(1.0)])] {
            let mut i = v.get_iterator().unwrap();
            assert!(i.next().is_some());
            assert!(i.next().is_none());
            assert!(i.next().is_none());
        }
    }
}
