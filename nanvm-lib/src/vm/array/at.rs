use super::{Array, relative::relative};
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, Nullish, ToAny},
};

impl<A: IVm> Array<A> {
    /// `Array.prototype.at(index)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.at>): the element at
    /// `index`, counted from the end when negative, and `undefined` out of
    /// range. The index is `ToIntegerOrInfinity` of the argument, so `1.7`
    /// reads element `1`, `"1"` too, and a missing argument — `undefined`,
    /// which is `NaN` as a number — reads element `0`. The one throw is the
    /// conversion's: a bigint argument is the `TypeError` `ToNumber` throws
    /// for one.
    ///
    /// The position is [`relative`]'s, unclamped: an infinite relative
    /// index lands out of range on either side, so `Index<u32>` is reached
    /// only with an index the range check admitted.
    pub(crate) fn at(&self, index: Any<A>) -> Result<Any<A>, Any<A>> {
        let k = relative(index, self.length())?;
        Ok(if (0.0..f64::from(self.length())).contains(&k) {
            self[k as u32].clone()
        } else {
            Nullish::Undefined.to_any()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, ToAny, ToArray, unstable::bigint_any},
    };

    type A = Naive;

    fn array() -> Array<A> {
        [10.0.to_any(), 20.0.to_any(), 30.0.to_any()].to_array()
    }
    fn undefined() -> Result<Any<A>, Any<A>> {
        Ok(Nullish::Undefined.to_any())
    }

    #[test]
    fn from_the_start_and_the_end() {
        assert_eq!(array().at(0.0.to_any()), Ok(10.0.to_any()));
        assert_eq!(array().at(2.0.to_any()), Ok(30.0.to_any()));
        assert_eq!(array().at((-1.0f64).to_any()), Ok(30.0.to_any()));
        assert_eq!(array().at((-3.0f64).to_any()), Ok(10.0.to_any()));
    }

    #[test]
    fn out_of_range_is_undefined() {
        assert_eq!(array().at(3.0.to_any()), undefined());
        assert_eq!(array().at((-4.0f64).to_any()), undefined());
        assert_eq!(array().at(f64::INFINITY.to_any()), undefined());
        assert_eq!(array().at(f64::NEG_INFINITY.to_any()), undefined());
        assert_eq!(Array::<A>::default().at(0.0.to_any()), undefined());
    }

    /// The index is `ToIntegerOrInfinity` of the argument: truncated, a
    /// string converted, `undefined` and `NaN` zero.
    #[test]
    fn index_is_converted() {
        assert_eq!(array().at(1.7.to_any()), Ok(20.0.to_any()));
        assert_eq!(array().at((-0.5f64).to_any()), Ok(10.0.to_any()));
        assert_eq!(array().at("1".into()), Ok(20.0.to_any()));
        assert_eq!(array().at(Nullish::Undefined.to_any()), Ok(10.0.to_any()));
        assert_eq!(array().at(f64::NAN.to_any()), Ok(10.0.to_any()));
    }

    /// A bigint index is the `TypeError` `ToNumber` throws for one.
    #[test]
    fn bigint_index_throws() {
        let one: Any<A> = bigint_any(1);
        assert_eq!(
            array().at(one),
            Err("TypeError: Cannot convert a BigInt value to a number".into())
        );
    }
}
