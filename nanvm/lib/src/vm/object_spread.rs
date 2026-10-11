use core::iter::FusedIterator;

use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Array, IVm, String, ToAny},
};

/// What [`Any::object_spread`] returns: the entries `{...v}` copies, each a
/// key and its value, in `[[OwnPropertyKeys]]` order. The object side's
/// counterpart of [`IteratorRecord`](crate::vm::IteratorRecord), and like
/// it a Rust iterator, never a VM value.
///
/// Copying cannot fail, and neither can creating one: an object spread of
/// any value is defined, a value with no own enumerable properties giving
/// none.
///
/// ```
/// use nanvm_lib::{vm::{Any, IVm, Nullish, ToAny, ToArray}, naive::Naive};
/// fn spread<A: IVm>() {
///     let a: Any<A> = [Any::from("x")].to_array().to_any();
///     assert_eq!(a.object_spread().count(), 1);
///     let s: Any<A> = "😀".into();
///     assert_eq!(s.object_spread().count(), 2);
///     assert_eq!(Nullish::Null.to_any::<A>().object_spread().count(), 0);
/// }
/// spread::<Naive>();
/// ```
pub enum ObjectSpread<A: IVm> {
    /// An object's entries, the deduplicated, ordered view
    /// [`Object::own_entries`](crate::vm::Object::own_entries) computes
    /// when the spread is created.
    Object(std::vec::IntoIter<(String<A>, Any<A>)>),
    /// An array's elements keyed by index: `"0"`, `"1"`, … `length` is not
    /// enumerable.
    Array { array: Array<A>, next: u32 },
    /// A string's code units keyed by index, each a one-unit string: a
    /// surrogate pair is two entries, as `{...'😀'}` is in JavaScript.
    String { string: String<A>, next: u32 },
    /// Every other value: no own enumerable properties.
    Empty,
}

/// The key of index `i`, as JavaScript's `ToString(i)` spells it.
fn index_key<A: IVm>(i: u32) -> String<A> {
    i.to_string().as_str().into()
}

impl<A: IVm> Iterator for ObjectSpread<A> {
    type Item = (String<A>, Any<A>);

    fn next(&mut self) -> Option<(String<A>, Any<A>)> {
        match self {
            ObjectSpread::Object(entries) => entries.next(),
            ObjectSpread::Array { array, next } => {
                if *next >= array.length() {
                    return None;
                }
                let entry = (index_key(*next), array[*next].clone());
                *next += 1;
                Some(entry)
            }
            ObjectSpread::String { string, next } => {
                if *next >= string.length() {
                    return None;
                }
                let entry = (index_key(*next), String::of_unit(string[*next]).to_any());
                *next += 1;
                Some(entry)
            }
            ObjectSpread::Empty => None,
        }
    }

    /// Exact for every variant.
    fn size_hint(&self) -> (usize, Option<usize>) {
        let left = match self {
            ObjectSpread::Object(entries) => entries.len(),
            ObjectSpread::Array { array, next } => array.length().saturating_sub(*next) as usize,
            ObjectSpread::String { string, next } => string.length().saturating_sub(*next) as usize,
            ObjectSpread::Empty => 0,
        };
        (left, Some(left))
    }
}

impl<A: IVm> ExactSizeIterator for ObjectSpread<A> {}

impl<A: IVm> FusedIterator for ObjectSpread<A> {}
