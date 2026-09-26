use super::Array;
use crate::vm::{Any, Function, IVm, Number, ToAny, ToArray};

/// The callback of an iteration or a fold: the argument converted to a
/// function before any element is visited, so `[].map(1)` throws as
/// JavaScript's `IsCallable` check does, even on an empty array. The throw
/// is the one `Any::call` throws for calling what is not a function.
pub(crate) fn callback<A: IVm>(f: Any<A>) -> Result<Function<A>, Any<A>> {
    Function::try_from(f)
}

impl<A: IVm> Array<A> {
    /// The callback called on element `i` as an iteration calls it: with the
    /// element, its index and the array itself — the same value, so
    /// `a === arr` holds in it. A second argument of the built-in, the
    /// `thisArg` JavaScript binds as `this`, has nowhere to go: no function
    /// here reads `this`, so it is accepted and has no effect, as it has
    /// none on a JavaScript arrow function.
    pub(crate) fn visit(&self, f: &Function<A>, i: u32) -> Result<Any<A>, Any<A>> {
        f.call([self[i].clone(), index(i), self.clone().to_any()].to_array())
    }

    /// The first of `indices` whose callback result is, as `ToBoolean` reads
    /// it, `wanted`, or `None`: `find` and `some` want `true`, `every` wants
    /// `false`, and `findLast` walks the indices backwards. Visiting stops at
    /// the answer, which is observable only through a throw the callback
    /// would have thrown later, since nothing else has an effect.
    pub(crate) fn position(
        &self,
        f: &Function<A>,
        indices: impl Iterator<Item = u32>,
        wanted: bool,
    ) -> Result<Option<u32>, Any<A>> {
        for i in indices {
            if self.visit(f, i)?.to_boolean() == wanted {
                return Ok(Some(i));
            }
        }
        Ok(None)
    }

    /// `reduce` and `reduceRight` over `indices`: the accumulator starts at
    /// `initial` when the call passed one, `undefined` included, and
    /// otherwise at the first visited element, the visit starting at the
    /// next — so an empty array with no initial value is the `TypeError`
    /// JavaScript throws, and one with an initial value answers it. Each
    /// step calls the callback with the accumulator, the element, its index
    /// and the array.
    pub(crate) fn fold(
        &self,
        f: &Function<A>,
        initial: Option<Any<A>>,
        mut indices: impl Iterator<Item = u32>,
    ) -> Result<Any<A>, Any<A>> {
        let first = match initial {
            Some(v) => v,
            None => match indices.next() {
                Some(i) => self[i].clone(),
                None => return Err("TypeError: Reduce of empty array with no initial value".into()),
            },
        };
        indices.try_fold(first, |acc, i| {
            f.call([acc, self[i].clone(), index(i), self.clone().to_any()].to_array())
        })
    }
}

/// An index as a callback receives it, a `Number`.
fn index<A: IVm>(i: u32) -> Any<A> {
    Number::from(f64::from(i)).to_any()
}

#[cfg(test)]
mod tests {
    use super::callback;
    use crate::{
        naive::Naive,
        vm::{Any, Array, Function, IStaticFunction, Nullish, ToAny, ToArray},
    };

    type A = Naive;

    /// `(...a) => a`: the arguments a callback was given, as an array.
    fn args() -> Function<A> {
        callback(A::static_function(|_, args| Ok(args.to_any()), 0, [].to_array()).to_any())
            .unwrap()
    }

    fn array() -> Array<A> {
        [10.0.to_any(), 20.0.to_any()].to_array()
    }

    #[test]
    fn not_a_function_throws() {
        assert!(callback::<A>(1.0.to_any()).is_err());
        assert!(callback::<A>(Nullish::Undefined.to_any()).is_err());
    }

    /// The element, its index, and the array itself.
    #[test]
    fn visit_arguments() {
        let a = array();
        let got: Array<A> = a.visit(&args(), 1).unwrap().try_into().unwrap();
        let got: Vec<Any<A>> = got.into_iter().collect();
        assert_eq!(got.len(), 3);
        assert_eq!(got[0], 20.0.to_any());
        assert_eq!(got[1], 1.0.to_any());
        assert_eq!(got[2], a.to_any());
    }

    #[test]
    fn fold_without_initial_value() {
        let empty = Array::<A>::default();
        assert_eq!(
            empty.fold(&args(), None, 0..0),
            Err("TypeError: Reduce of empty array with no initial value".into())
        );
        assert_eq!(
            empty.fold(&args(), Some(1.0.to_any()), 0..0),
            Ok(1.0.to_any())
        );
        assert_eq!(array().fold(&args(), None, 1..2), Ok(20.0.to_any()));
    }
}
