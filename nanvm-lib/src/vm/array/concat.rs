use super::{Array, create::create};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, ToArray, Unpacked},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.concat(...items)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.concat>): a new array of
    /// the receiver's elements, then each item's in order — an array's
    /// elements spliced in, one level only, and any other value whole, an
    /// object included. A module cannot spell `Symbol.isConcatSpreadable`,
    /// so being an array is the whole of what spreads. A result past the
    /// length limit is the `RangeError` [`create`] throws.
    pub(crate) fn concat(&self, items: Array<A>) -> Result<Array<A>, Any<A>> {
        let spread = |item: Any<A>| match Unpacked::from(item.clone()) {
            Unpacked::Array(a) => a,
            _ => [item].to_array(),
        };
        let parts: Vec<Array<A>> = [self.clone()]
            .into_iter()
            .chain(items.into_iter().map(spread))
            .collect();
        let len = parts.iter().map(|a| u64::from(a.length())).sum();
        create(len, parts.into_iter().flatten())
    }
}

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{
        naive::Naive,
        vm::{Any, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    #[test]
    fn spreads_arrays_one_level() {
        let one: Array<A> = [1.0.to_any()].to_array();
        let nested: Any<A> = [[3.0.to_any()].to_array().to_any()].to_array().to_any();
        let items: Array<A> = [2.0.to_any(), nested.clone()].to_array();
        let result: Vec<Any<A>> = one.concat(items).unwrap().into_iter().collect();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], 1.0.to_any());
        assert_eq!(result[1], 2.0.to_any());
        assert!(matches!(
            crate::vm::Unpacked::from(result[2].clone()),
            crate::vm::Unpacked::Array(_)
        ));
    }

    #[test]
    fn appends_an_object_whole() {
        let object: Any<A> = [].to_object().to_any();
        let items: Array<A> = [object.clone()].to_array();
        let result: Vec<Any<A>> = Array::<A>::default()
            .concat(items)
            .unwrap()
            .into_iter()
            .collect();
        assert_eq!(result, vec![object]);
    }
}
