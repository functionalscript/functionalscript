use core::ops::Add;

use crate::vm::{IVm, String, ToString, Unpacked};

impl<A: IVm> Add for String<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        self.into_iter().chain(rhs).to_string()
    }
}

impl<A: IVm> Add for Unpacked<A> {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        match (self, rhs) {
            (Self::Number(a), Self::Number(b)) => (a + b).into(),
            (Self::String(a), Self::String(b)) => (a + b).into(),
            (Self::BigInt(a), Self::BigInt(b)) => (a + b).into(),
            // TODO:
            _ => todo!("implement according to the standard"),
        }
    }
}