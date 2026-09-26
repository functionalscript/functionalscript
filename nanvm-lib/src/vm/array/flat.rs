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
    /// limit is the `RangeError` [`create`] throws, counted before anything
    /// is built.
    ///
    /// Recursion follows nesting, so an array nested deeply enough overflows
    /// the stack; see `nanvm-lib/todo/array-deep-nesting.md`.
    pub(crate) fn flat(&self, depth: f64) -> Result<Array<A>, Any<A>> {
        let len = flat_length(self.clone().into_iter(), depth);
        create(len, built(|| flatten(self.clone().into_iter(), depth)))
    }

    /// `Array.prototype.flatMap(f)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.flatmap>): `map` and
    /// then one level of `flat` — an answer that is an array is spliced in,
    /// its own elements as they are, and any other answer appended.
    pub(crate) fn flat_map(&self, f: &Function<A>) -> Result<Array<A>, Any<A>> {
        let answers: Result<Vec<Any<A>>, Any<A>> =
            (0..self.length()).map(|i| self.visit(f, i)).collect();
        let answers = answers?;
        let len = flat_length(answers.iter().cloned(), 1.0);
        create(len, built(|| flatten(answers.into_iter(), 1.0)))
    }
}

/// The elements `build` answers, built on the first `next`, so none are
/// built when [`create`] refuses the length without iterating.
fn built<A: IVm>(build: impl FnOnce() -> Vec<Any<A>>) -> impl Iterator<Item = Any<A>> {
    std::iter::once(build).flat_map(|build| build())
}

/// The length [`flatten`] would answer, counted without building it. An
/// array whose own elements are not flattened further counts as its
/// length, so wide sharing costs one step per reference, and the count
/// stops as soon as it is past the limit.
fn flat_length<A: IVm>(mut items: impl Iterator<Item = Any<A>>, depth: f64) -> u64 {
    const PAST: u64 = u32::MAX as u64 + 1;
    items
        .try_fold(0, |n, item| {
            let m = n + match Unpacked::from(item) {
                Unpacked::Array(a) if depth > 1.0 => flat_length(a.into_iter(), depth - 1.0),
                Unpacked::Array(a) if depth > 0.0 => u64::from(a.length()),
                _ => 1,
            };
            if m < PAST { Ok(m) } else { Err(PAST) }
        })
        .unwrap_or_else(|past| past)
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

    /// 2¹⁶ references to one array of 2¹⁶ elements flatten to 2³², one
    /// past the limit: refused, and counted without building a thing.
    #[test]
    fn too_long_is_refused_before_it_is_built() {
        let wide: Any<A> = (0..1u32 << 16).map(|_| 0.0.to_any()).to_array().to_any();
        let shared: Array<A> = (0..1u32 << 16).map(|_| wide.clone()).to_array();
        assert!(shared.flat(1.0).is_err());
        assert_eq!(length(shared.flat(0.0).unwrap()), 1 << 16);
    }
}
