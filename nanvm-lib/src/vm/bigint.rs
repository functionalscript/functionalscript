use crate::{
    common::{array::SizedIndex, default::default, serializable::Serializable},
    sign::Sign,
    vm::{
        number_coercion::NumberCoercion,
        string_coercion::{StringCoercion, ToString16Result},
        Any, IContainer, IVm, String16, Unpacked,
    },
};
use core::fmt::{Debug, Formatter, Write};
use std::io;

/// ```
/// use nanvm_lib::vm::{BigInt, IVm, naive::Naive};
/// fn bigint_test<A: IVm>() {
///     let a: BigInt<A> = 12345678901234567890u64.into();
///     let b: BigInt<A> = (-1234567890123456789i64).into();
/// }
///
/// bigint_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct BigInt<A: IVm>(A::InternalBigInt);

impl<A: IVm> Default for BigInt<A> {
    fn default() -> Self {
        Self(A::InternalBigInt::new_empty(Sign::Positive))
    }
}

impl<A: IVm> From<u64> for BigInt<A> {
    fn from(value: u64) -> Self {
        if value == 0 {
            return default();
        }
        BigInt(A::InternalBigInt::new_ok(Sign::Positive, [value]))
    }
}

impl<A: IVm> From<i64> for BigInt<A> {
    fn from(value: i64) -> Self {
        if value == 0 {
            return default();
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
        if let Unpacked::BigInt(result) = value.into() {
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
        let items = self.0.items();
        let last = items.length() - 1;
        write!(f, "{:X}", items[last])?;
        for i in (0..last).rev() {
            write!(f, "_{:016X}", items[i])?;
        }
        f.write_char('n')
    }
}

impl<A: IVm> Serializable for BigInt<A> {
    fn serialize(self, write: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl io::Read) -> io::Result<Self> {
        A::InternalBigInt::deserialize(read).map(Self)
    }
}

impl<A: IVm> StringCoercion<A> for BigInt<A> {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        // TODO: we should use different algorithm for large numbers.
        format!("{self:?}").to_string16_result()
    }
}

impl<A: IVm> NumberCoercion<A> for BigInt<A> {
    fn coerce_to_number(self) -> Result<f64, Any<A>> {
        Err("TypeError: Cannot convert a BigInt value to a number".into())
    }
}
