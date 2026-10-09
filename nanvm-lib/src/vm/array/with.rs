use super::{Array, relative::relative};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, ToArray, error},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.with(index, value)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.with>): a copy with the
    /// element at `index` replaced by `value`. `index` is a [`relative`]
    /// position, unclamped: one outside the array is a `RangeError`, before
    /// anything is copied.
    pub(crate) fn with(&self, index: Any<A>, value: Any<A>) -> Result<Array<A>, Any<A>> {
        let len = self.length();
        let k = relative(index, len)?;
        if !(0.0..f64::from(len)).contains(&k) {
            return Err(error::invalid_index());
        }
        let k = k as u32;
        Ok((0..len)
            .map(|i| {
                if i == k {
                    value.clone()
                } else {
                    self[i].clone()
                }
            })
            .to_array())
    }
}

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{
        naive::Naive,
        vm::{Any, ToAny, ToArray, error},
    };

    type A = Naive;

    fn with(index: f64) -> Result<Vec<Any<A>>, Any<A>> {
        let a: Array<A> = [1.0.to_any(), 2.0.to_any()].to_array();
        a.with(index.to_any(), 0.0.to_any())
            .map(|r| r.into_iter().collect())
    }

    #[test]
    fn replaces_one() {
        assert_eq!(with(0.0), Ok(vec![0.0.to_any(), 2.0.to_any()]));
        assert_eq!(with(-1.0), Ok(vec![1.0.to_any(), 0.0.to_any()]));
    }

    #[test]
    fn out_of_range_throws() {
        let invalid = Err(error::invalid_index());
        assert_eq!(with(2.0), invalid);
        assert_eq!(with(-3.0), invalid);
        assert_eq!(with(f64::INFINITY), invalid);
    }
}
