use crate::{sign::Sign, vm::{Any, IContainer, IInternalAny, Unpacked}};
use std::fmt::{Debug, Formatter, Write};

#[derive(Clone)]
pub struct BigInt<A: IInternalAny>(pub A::InternalBigInt);

impl<A: IInternalAny> PartialEq for BigInt<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.deep_eq(&other.0)
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for BigInt<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::BigInt(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IInternalAny> Debug for BigInt<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let len = self.0.len();
        if len == 0 {
            return f.write_str("0n");
        }
        if *self.0.header() == Sign::Negative {
            f.write_char('-')?;
        }
        f.write_str("0x")?;
        let last = len - 1;
        write!(f, "{:X}", self.0.at(last))?;
        for i in (0..last).rev() {
            write!(f, "_{:016X}", self.0.at(i))?;
        }
        f.write_char('n')
    }
}
