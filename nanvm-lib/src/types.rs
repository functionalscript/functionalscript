use std::ops::{Add, Mul};

use crate::{
    internal::{self, Complex, Container},
    sign::Sign,
};

#[derive(Clone, Debug, PartialEq)]
#[repr(transparent)]
pub struct Any<T: internal::Any>(pub T);

impl<T: internal::Any> Any<T> {
    pub fn big_int(header: Sign, items: impl IntoIterator<Item = u64>) -> Self {
        T::BigInt::new(header, items).to_unknown()
    }
}

impl<T: internal::Any> Add for Any<T> {
    type Output = Result<Self, Self>;

    fn add(self, other: Self) -> Self::Output {
        T::add(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: internal::Any> Mul for Any<T> {
    type Output = Result<Self, Self>;

    fn mul(self, other: Self) -> Self::Output {
        T::mul(self.0, other.0).map(Self).map_err(Self)
    }
}
