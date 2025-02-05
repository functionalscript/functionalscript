/**
 * Initial implementation of BigInt based on https://github.com/functionalscript/nanvm/tree/main/nanvm-lib/src/big_numbers/big_int.rs
 * Credits: https://github.com/Trinidadec
 */
use std::cmp::Ordering;

use crate::{
    big_uint::BigUint,
    interface::{Any, Complex, Container},
    sign::Sign,
};

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
    fn add(self, other: Self) -> Self {
        if *self.header() == *other.header() {
            Self::new(
                self.header().clone(),
                BigUint::add(self.items(), other.items()).value,
            )
        } else {
            match self.items().cmp(other.items()) {
                Ordering::Equal => Self::zero(),
                Ordering::Greater => Self::new(
                    self.header().clone(),
                    BigUint::sub(self.items(), other.items()).value,
                ),
                Ordering::Less => Self::new(
                    other.header().clone(),
                    BigUint::sub(other.items(), self.items()).value,
                ),
            }
        }
    }
    fn sub(self, other: Self) -> Self {
        self.add(other.negate())
    }
    fn muldiv_result(&self, other: &Self, uint_result: BigUint) -> Self {
        if *self.header() != *other.header() && !uint_result.is_zero() {
            Self::new(Sign::Negative, uint_result.value)
        } else {
            Self::new(Sign::Positive, uint_result.value)
        }
    }
    fn mul(self, other: Self) -> Self {
        self.muldiv_result(&other, BigUint::mul(self.items(), other.items()))
    }
    fn div(self, other: Self) -> Self {
        let (uint_result, _) = BigUint::div_mod(self.items(), other.items());
        self.muldiv_result(&other, uint_result)
    }
    fn shl(self, other: Self) -> Self {
        Self::new(
            self.header().clone(),
            BigUint::shl(self.items(), other.items()).value,
        )
    }
    fn shr(self, other: Self) -> Self {
        Self::new(
            self.header().clone(),
            BigUint::shr(self.items(), other.items()).value,
        )
    }
}
