use super::Array;
use core::mem;

use crate::vm::{Any, IVm, String, ToString, Unpacked};

impl<A: IVm> Array<A> {
    /// `Array.prototype.join(separator)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.join>) over a
    /// separator already converted: the elements converted to strings and
    /// joined by it, `undefined` and `null` as the empty string and every
    /// other element by `ToString`, whose throw is the result. A nested
    /// array converts through its own `toString`, that is this with `","`.
    /// `Array.prototype.toString` is this with `","` too, and the `String(a)`
    /// conversion of an array (`vm/primitive_coercion.rs`) calls it, so the
    /// two cannot disagree.
    ///
    /// Nesting is walked on a heap stack and the text goes into one buffer. An
    /// element that is an array is not converted by a call but by a frame of
    /// its own, its elements joined by `","` straight into the buffer, since an
    /// array cannot own a `toString` and a nested array's conversion is always
    /// this.
    ///
    /// Destruction still depends on the VM: a consuming wrapper, including
    /// `String(a)`, can overflow when it releases a sole-owned deep `Naive`
    /// receiver. See `nanvm-lib/todo/array-deep-nesting.md`.
    pub(crate) fn join(&self, separator: String<A>) -> Result<String<A>, Any<A>> {
        let comma: String<A> = ",".into();
        let mut out: Vec<u16> = Vec::new();
        let mut stack = vec![Frame::new(self.clone(), separator)];
        while let Some(frame) = stack.last_mut() {
            match frame.items.next() {
                Some(v) => {
                    if !mem::replace(&mut frame.first, false) {
                        out.extend(frame.separator.clone());
                    }
                    match Unpacked::from(v) {
                        Unpacked::Array(a) => stack.push(Frame::new(a, comma.clone())),
                        Unpacked::Nullish(_) => {}
                        other => out.extend(Any::from(other).to_string()?),
                    }
                }
                None => {
                    stack.pop();
                }
            }
        }
        Ok(out.into_iter().to_string())
    }
}

/// An array being joined: what is left of it, whether nothing of it is written
/// yet, and the separator between its elements.
struct Frame<A: IVm> {
    items: <Array<A> as IntoIterator>::IntoIter,
    first: bool,
    separator: String<A>,
}

impl<A: IVm> Frame<A> {
    fn new(array: Array<A>, separator: String<A>) -> Self {
        Frame {
            items: array.into_iter(),
            first: true,
            separator,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Array, Nullish, String, ToAny, ToArray},
    };

    type A = Naive;

    fn join(items: Vec<Any<A>>, separator: &str) -> Result<String<A>, Any<A>> {
        items.to_array().join(separator.into())
    }

    #[test]
    fn joins_converted_elements() {
        let nested: Any<A> = [2.0.to_any(), 3.0.to_any()].to_array().to_any();
        assert_eq!(
            join(
                vec![
                    1.0.to_any(),
                    Nullish::Null.to_any(),
                    Nullish::Undefined.to_any(),
                    nested,
                    "a".into()
                ],
                ";"
            ),
            Ok("1;;;2,3;a".into())
        );
        assert_eq!(join(vec![], ";"), Ok("".into()));
        assert_eq!(join(vec![1.0.to_any(), 2.0.to_any()], ""), Ok("12".into()));
    }

    /// An array nested far past the stack joins: a chain of single-element
    /// arrays around a string is that string, and `String(a)` agrees.
    #[test]
    fn joins_a_deeply_nested_array() {
        use crate::vm::test::deep::{DEPTH, leak, nested_arrays, small_stack};
        small_stack(|| {
            let a = nested_arrays(DEPTH, "x".into());
            leak(a.clone());
            let array = Array::try_from(a.clone()).unwrap();
            assert_eq!(array.join(",".into()), Ok("x".into()));
            assert_eq!(a.clone().to_string(), Ok("x".into()));
        });
    }

    /// Every level also holds a number, so the text is as long as the nesting
    /// is deep: `[0, [1, [2, …]]]` is `0,1,2,…`, each nested array joined by
    /// a comma whatever the separator of the outer one.
    #[test]
    fn joins_every_level_of_a_deep_array() {
        use crate::vm::test::deep::{DEPTH, leak, small_stack};
        small_stack(|| {
            let a = (0..DEPTH)
                .rev()
                .fold(Nullish::Null.to_any::<A>(), |inner, i| {
                    [(i as f64).to_any(), inner].to_array().to_any()
                });
            leak(a.clone());
            let array = Array::try_from(a.clone()).unwrap();
            let joined: String<A> = array.join(";".into()).unwrap();
            let text: std::string::String =
                char::decode_utf16(joined).map(|c| c.unwrap()).collect();
            // The outer separator joins only the top array's own two
            // elements; the innermost array ends in a `null`, the empty
            // string, after its number's comma.
            let nested: Vec<std::string::String> = (1..DEPTH).map(|i| i.to_string()).collect();
            assert_eq!(text, format!("0;{},", nested.join(",")));
        });
    }
}
