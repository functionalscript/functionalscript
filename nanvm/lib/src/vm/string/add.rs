use core::ops::{Add, AddAssign};

use super::String;
use crate::vm::{ContainerWrapper, IVm, internal::IContainer};

impl<A: IVm> String<A> {
    /// The code units of `self` and then of `other`, copied in bulk into
    /// one new string ([`IContainer::concat`]).
    pub fn concat(&self, other: &Self) -> Self {
        String(self.internal().concat(other.internal()))
    }
}

impl<A: IVm> Add for String<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        self.concat(&rhs)
    }
}

impl<A: IVm> AddAssign for String<A> {
    fn add_assign(&mut self, other: Self) {
        *self = self.clone() + other;
    }
}
