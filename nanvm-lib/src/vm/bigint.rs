use crate::{
    common::{default::default, serializable::Serializable},
    sign::Sign,
    vm::{Any, IContainer, IVm, Js, String16, Unpacked},
};
use std::{
    fmt::{Debug, Formatter, Write},
    io,
};

#[derive(Clone)]
pub struct BigInt<A: IVm>(pub A::InternalBigInt);

impl<A: IVm> Default for BigInt<A> {
    fn default() -> Self {
        Self(A::InternalBigInt::new_empty(Sign::Positive))
    }
}

impl<A: IVm> From<u64> for BigInt<A> {
    fn from(value: u64) -> Self {
        if value == 0 {
            return BigInt::default();
        }
        BigInt(A::InternalBigInt::new_ok(Sign::Positive, [value]))
    }
}

impl<A: IVm> From<i64> for BigInt<A> {
    fn from(value: i64) -> Self {
        if value == 0 {
            return BigInt::default();
        }
        let (sign, v) = if value < 0 {
            (Sign::Negative, value.overflowing_neg().0 as u64)
        } else {
            (Sign::Positive, value as u64)
        };
        BigInt(A::InternalBigInt::new_ok(sign, [v]))
    }
}

impl<A: IVm> BigInt<A> {
    fn is_zero(&self) -> bool {
        self.0.is_empty()
    }
}

impl<A: IVm> PartialEq for BigInt<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.items_eq(&other.0)
    }
}

impl<A: IVm> TryFrom<Any<A>> for BigInt<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::BigInt(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> Debug for BigInt<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        if self.is_zero() {
            return f.write_str("0n");
        }
        if *self.0.header() == Sign::Negative {
            f.write_char('-')?;
        }
        f.write_str("0x")?;
        let last = self.0.len() - 1;
        write!(f, "{:X}", self.0.at(last))?;
        for i in (0..last).rev() {
            write!(f, "_{:016X}", self.0.at(i))?;
        }
        f.write_char('n')
    }
}

impl<A: IVm> Js<A> for BigInt<A> {
    fn string(&self) -> String16<A> {
        // TODO: Implement proper conversion to String16
        default()
    }
}

impl<A: IVm> Serializable for BigInt<A> {
    fn serialize(&self, write: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl io::Read) -> io::Result<Self> {
        A::InternalBigInt::deserialize(read).map(Self)
    }
}
