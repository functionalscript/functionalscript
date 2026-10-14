use crate::{
    common::sized_index::SizedIndex,
    vm::{
        Any, Array, BigInt, Function, IVm, Number, Object, String, Unpacked, error,
        nullish::Nullish,
    },
};

impl<A: IVm> TryFrom<Any<A>> for Nullish {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Nullish(result) = value.into() else {
            return Err(error::unexpected_type());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for bool {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Boolean(result) = value.into() else {
            return Err(error::unexpected_type());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Number {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Number(result) = value.into() else {
            return Err(error::unexpected_type());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Array<A> {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Array(result) = value.into() else {
            return Err(error::unexpected_type());
        };
        Ok(result)
    }
}

/// An array of exactly `N` items as a fixed-size Rust array, to destructure:
/// `let [tag, value]: [Any<A>; 2] = array.try_into()?`. An array of any other
/// length is handed back unchanged, as `Vec`'s conversion hands back the `Vec`.
impl<A: IVm, const N: usize> TryFrom<Array<A>> for [Any<A>; N] {
    type Error = Array<A>;
    fn try_from(value: Array<A>) -> Result<Self, Self::Error> {
        if value.length() as usize != N {
            return Err(value);
        }
        Ok(core::array::from_fn(|i| value[i as u32].clone()))
    }
}

impl<A: IVm> TryFrom<Any<A>> for BigInt<A> {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::BigInt(result) = value.into() else {
            return Err(error::unexpected_type());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Function<A> {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Function(result) = value.into() else {
            return Err(error::unexpected_type());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Object<A> {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::Object(result) = value.into() else {
            return Err(error::unexpected_type());
        };
        Ok(result)
    }
}

impl<A: IVm> TryFrom<Any<A>> for String<A> {
    type Error = Any<A>;
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        let Unpacked::String(result) = value.into() else {
            return Err(error::unexpected_type());
        };
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Array, ToAny, ToArray},
    };

    type A = Naive;

    fn array<const N: usize>(items: [f64; N]) -> Array<A> {
        items.map(|n| n.to_any::<A>()).to_array()
    }

    #[test]
    fn an_array_of_exactly_n_items_is_unpacked() {
        let [a, b]: [Any<A>; 2] = array([1.0, 2.0]).try_into().unwrap();
        assert_eq!((a, b), (1.0.to_any(), 2.0.to_any()));
        let []: [Any<A>; 0] = array([]).try_into().unwrap();
    }

    #[test]
    fn any_other_length_is_handed_back() {
        for items in [array([1.0]), array([1.0, 2.0, 3.0])] {
            let refused: Result<[Any<A>; 2], _> = items.clone().try_into();
            assert_eq!(refused, Err(items));
        }
    }
}
