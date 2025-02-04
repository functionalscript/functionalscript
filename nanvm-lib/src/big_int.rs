use crate::{big_uint::BigUint, interface::{Any, Complex, Container}, sign::Sign};

pub trait BigInt<U: Any<BigInt = Self>>: Complex<U> + Container<Header = Sign, Item = u64> {
    fn is_zero(&self) -> bool {
        self.items().is_empty()
    }
    fn zero() -> Self {
        Self::new(Sign::Positive, [])
    }
    fn negate(self) -> Self {
        match self.header() {
            Sign::Positive => Self::new(Sign::Negative, self.items().iter().cloned()),
            Sign::Negative => Self::new(Sign::Positive, self.items().iter().cloned()),
        }
    }
    fn mul(self, other: Self) -> Self {
        let uint_result = BigUint::mul(&self.items(), &other.items());
        if *self.header() != *other.header() && !uint_result.is_zero() {
            Self::new(Sign::Negative, uint_result.value)
        } else {
            Self::new(Sign::Positive, uint_result.value)
        }
    }
}

#[cfg(test)]
mod test {
    use wasm_bindgen_test::wasm_bindgen_test;

    use crate::big_int::BigUint;

    #[test]
    #[wasm_bindgen_test]
    fn test_mul() {
        let a = BigUint { value: [1u64].to_vec() };
        let result = &a * &BigUint::ZERO;
        assert_eq!(&result, &BigUint::ZERO);
        let result = &BigUint::ZERO * &a;
        assert_eq!(&result, &BigUint::ZERO);

        let a = BigUint { value: [1].to_vec() };
        let result = &a * &a;
        assert_eq!(&result, &a);

        let a = BigUint {
            value: [1, 2, 3, 4].to_vec(),
        };
        let b = BigUint {
            value: [5, 6, 7].to_vec(),
        };
        let result = &a * &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [5, 16, 34, 52, 45, 28].to_vec()
            },
        );
        let result = &b * &a;
        assert_eq!(
            &result,
            &BigUint {
                value: [5, 16, 34, 52, 45, 28].to_vec()
            },
        );

        let a = BigUint {
            value: [u64::MAX].to_vec(),
        };
        let b = BigUint {
            value: [u64::MAX].to_vec(),
        };
        let result = &a * &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [1, u64::MAX - 1].to_vec()
            },
        );
        let result = &b * &a;
        assert_eq!(
            &result,
            &BigUint {
                value: [1, u64::MAX - 1].to_vec()
            },
        );

        let a = BigUint {
            value: [u64::MAX, u64::MAX, u64::MAX].to_vec(),
        };
        let b = BigUint {
            value: [u64::MAX].to_vec(),
        };
        let result = &a * &b;
        assert_eq!(
            &result,
            &BigUint {
                value: [1, u64::MAX, u64::MAX, u64::MAX - 1].to_vec()
            },
        );
        let result = &b * &a;
        assert_eq!(
            &result,
            &BigUint {
                value: [1, u64::MAX, u64::MAX, u64::MAX - 1].to_vec()
            },
        );
    }
}
