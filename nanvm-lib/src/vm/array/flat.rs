use super::{Array, create::create};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, Function, IVm, Unpacked},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.flat(depth)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.flat>) over a depth
    /// already converted: a new array with every element that is an array
    /// spliced in, recursively, to `depth` levels. `f64::INFINITY` flattens
    /// fully, and a depth of `0` or less copies. A result past the length
    /// limit is the `RangeError` [`create`] throws.
    ///
    /// Recursion follows nesting, so an array nested deeply enough overflows
    /// the stack; see `nanvm-lib/todo/array-deep-nesting.md`.
    pub(crate) fn flat(&self, depth: f64) -> Result<Array<A>, Any<A>> {
        let items = flatten(self.clone().into_iter(), depth);
        create(items.len() as u64, items)
    }

    /// `Array.prototype.flatMap(f)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.flatmap>): `map` and
    /// then one level of `flat` — an answer that is an array is spliced in,
    /// its own elements as they are, and any other answer appended.
    pub(crate) fn flat_map(&self, f: &Function<A>) -> Result<Array<A>, Any<A>> {
        let answers: Result<Vec<Any<A>>, Any<A>> =
            (0..self.length()).map(|i| self.visit(f, i)).collect();
        let items = flatten(answers?.into_iter(), 1.0);
        create(items.len() as u64, items)
    }
}

/// `FlattenIntoArray`: each item, or, for an item that is an array while
/// `depth` is above zero, its own elements flattened one level less.
fn flatten<A: IVm>(items: impl Iterator<Item = Any<A>>, depth: f64) -> Vec<Any<A>> {
    items
        .flat_map(|item| match Unpacked::from(item.clone()) {
            Unpacked::Array(a) if depth > 0.0 => flatten(a.into_iter(), depth - 1.0),
            _ => vec![item],
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{
        naive::Naive,
        vm::{Any, ToAny, ToArray},
    };

    type A = Naive;

    /// `[1, [2, [3]]]`.
    fn nested() -> Array<A> {
        let three: Any<A> = [3.0.to_any()].to_array().to_any();
        let two: Any<A> = [2.0.to_any(), three].to_array().to_any();
        [1.0.to_any(), two].to_array()
    }
    fn length(a: Array<A>) -> usize {
        a.into_iter().count()
    }

    #[test]
    fn to_a_depth() {
        assert_eq!(length(nested().flat(0.0).unwrap()), 2);
        assert_eq!(length(nested().flat(-1.0).unwrap()), 2);
        assert_eq!(length(nested().flat(1.0).unwrap()), 3);
        assert_eq!(length(nested().flat(f64::INFINITY).unwrap()), 3);
        let flat: Vec<Any<A>> = nested().flat(f64::INFINITY).unwrap().into_iter().collect();
        assert_eq!(flat, vec![1.0.to_any(), 2.0.to_any(), 3.0.to_any()]);
    }
}
