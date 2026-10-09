use crate::vm::{Any, IVm, IteratorRecord, Unpacked, error};

impl<A: IVm> Any<A> {
    /// ECMAScript's `GetIterator(self, sync)`
    /// (<https://tc39.es/ecma262/#sec-getiterator>), restricted to the values
    /// a FunctionalScript module can build: an array's elements, or a
    /// string's code points, each a string. Every other value — `null`,
    /// `undefined`, a boolean, a number, a `bigint`, an object, a function —
    /// is not iterable, and the `TypeError` is raised here, before any
    /// element. No object is iterable: a module cannot spell
    /// `Symbol.iterator`.
    ///
    /// The one protocol behind array spread, call spread and array
    /// destructuring. Not `Array::concat`, which keeps a non-array item
    /// whole: `[...'ab']` is `['a', 'b']`, not `['ab']`, and `[...{}]`
    /// throws.
    pub fn get_iterator(self) -> Result<IteratorRecord<A>, Any<A>> {
        match self.into() {
            Unpacked::Array(array) => Ok(IteratorRecord::Array { array, next: 0 }),
            Unpacked::String(string) => Ok(IteratorRecord::String { string, next: 0 }),
            _ => Err(error::not_iterable()),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{
            Any, IStaticFunction, Nullish, ToAny, ToArray, ToObject, error,
            unstable::{bigint_any, f64_any},
        },
    };

    type A = Naive;

    /// Every value that is not an array or a string throws, an empty object
    /// included: `[...1]`, `[...null]`, `[...{}]`.
    #[test]
    fn not_iterable() {
        let values: [Any<A>; 8] = [
            Nullish::Null.to_any(),
            Any::undefined(),
            true.to_any(),
            f64_any(0x3ff0000000000000),
            bigint_any(1),
            [].to_object().to_any(),
            [("0".into(), 1.0.to_any())].to_object().to_any(),
            A::static_function(|_, _| Ok(Any::undefined()), 0, [].to_array(), None).to_any(),
        ];
        for v in values {
            assert_eq!(v.get_iterator().err(), Some(error::not_iterable()));
        }
    }

    #[test]
    fn iterable() {
        let empty: Any<A> = "".into();
        assert!(empty.get_iterator().is_ok());
        let array: Any<A> = [].to_array().to_any();
        assert!(array.get_iterator().is_ok());
    }
}
