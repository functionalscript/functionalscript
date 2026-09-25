use super::Array;
use crate::vm::{Any, IVm, Nullish, String, join::Join};

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
    /// Recursion follows nesting, so an array nested deeply enough overflows
    /// the stack; see `nanvm-lib/todo/array-member-functions.md`.
    pub(crate) fn join(&self, separator: String<A>) -> Result<String<A>, Any<A>> {
        self.clone()
            .into_iter()
            .map(|v| match Nullish::try_from(v.clone()) {
                Ok(_) => Ok("".into()),
                Err(_) => v.to_string(),
            })
            .join(separator)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, String, ToAny, ToArray},
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
}
