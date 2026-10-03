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
    /// Nesting is walked on a heap stack. Destruction still depends on the VM:
    /// a consuming wrapper can overflow when it releases a sole-owned deep
    /// `Naive` receiver. See `nanvm-lib/todo/array-deep-nesting.md`.
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

/// One array being walked: what is left of it and the `depth` it is
/// flattened to.
type Walk<'a, A> = (Box<dyn Iterator<Item = Any<A>> + 'a>, f64);

/// The length [`flatten`] would answer, counted without building it. An
/// array whose own elements are not flattened further counts as its
/// length, so wide sharing costs one step per reference, and the count
/// stops as soon as it is past the limit.
///
/// The arrays being walked are a stack on the heap, so a nesting of any depth
/// is counted in constant stack.
fn flat_length<'a, A: IVm + 'a>(items: impl Iterator<Item = Any<A>> + 'a, depth: f64) -> u64 {
    const PAST: u64 = u32::MAX as u64 + 1;
    let mut stack: Vec<Walk<'a, A>> = vec![(Box::new(items), depth)];
    let mut n: u64 = 0;
    while let Some((items, depth)) = stack.last_mut() {
        let depth = *depth;
        match items.next() {
            None => {
                stack.pop();
            }
            Some(item) => match Unpacked::from(item) {
                Unpacked::Array(a) if depth > 1.0 => {
                    stack.push((Box::new(a.into_iter()), depth - 1.0))
                }
                Unpacked::Array(a) if depth > 0.0 => n += u64::from(a.length()),
                _ => n += 1,
            },
        }
        if n >= PAST {
            return PAST;
        }
    }
    n
}

/// `FlattenIntoArray`: each item, or, for an item that is an array while
/// `depth` is above zero, its own elements flattened one level less, on a
/// heap stack like [`flat_length`].
fn flatten<'a, A: IVm + 'a>(items: impl Iterator<Item = Any<A>> + 'a, depth: f64) -> Vec<Any<A>> {
    let mut stack: Vec<Walk<'a, A>> = vec![(Box::new(items), depth)];
    let mut out = Vec::new();
    while let Some((items, depth)) = stack.last_mut() {
        let depth = *depth;
        match items.next() {
            None => {
                stack.pop();
            }
            Some(item) => match Unpacked::from(item.clone()) {
                Unpacked::Array(a) if depth > 0.0 => {
                    stack.push((Box::new(a.into_iter()), depth - 1.0))
                }
                _ => out.push(item),
            },
        }
    }
    out
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

    /// An array nested far past the stack flattens: a chain of single-element
    /// arrays around a number is that number, and a number at every level
    /// comes out in order.
    #[test]
    fn flattens_a_deeply_nested_array() {
        use crate::vm::{
            Nullish,
            test::deep::{DEPTH, leak, nested_arrays, small_stack},
        };
        small_stack(|| {
            let chain = nested_arrays(DEPTH, 7.0.to_any());
            leak(chain.clone());
            let flat = Array::try_from(chain.clone()).unwrap().flat(f64::INFINITY);
            assert_eq!(
                flat.unwrap().into_iter().collect::<Vec<_>>(),
                [7.0.to_any()]
            );
            // To a depth the walk stops at the chain's `depth`th array.
            let two = Array::try_from(chain.clone()).unwrap().flat(2.0).unwrap();
            assert_eq!(length(two), 1);

            let every = (0..DEPTH)
                .rev()
                .fold(Nullish::Null.to_any::<A>(), |inner, i| {
                    [(i as f64).to_any(), inner].to_array().to_any()
                });
            leak(every.clone());
            let flat = Array::try_from(every.clone())
                .unwrap()
                .flat(f64::INFINITY)
                .unwrap();
            let items: Vec<Any<A>> = flat.into_iter().collect();
            assert_eq!(items.len(), DEPTH + 1);
            assert_eq!(items[0], 0.0.to_any());
            assert_eq!(items[DEPTH - 1], ((DEPTH - 1) as f64).to_any());
            assert_eq!(items[DEPTH], Nullish::Null.to_any());
        });
    }
}
