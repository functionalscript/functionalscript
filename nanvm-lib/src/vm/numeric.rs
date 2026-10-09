use std::ops::{Add, BitAnd, BitOr, BitXor, Div, Mul, Neg, Rem, Shl, Shr, Sub};

use crate::vm::{Any, BigInt, IVm, Number, Unpacked, error};

/// `ToUint32(rhs) & 0x1F`: the shift-count operand of `<<`/`>>`/`>>>`
/// between two `Number`s is reduced modulo 32 — a `u32` shift always in
/// `0..=31`, so it can never panic Rust's own `<<`/`>>` on `i32`/`u32`
/// (which requires a shift strictly less than the type's 32-bit width, i.e.
/// at most 31).
fn shift_count(rhs: Number) -> u32 {
    rhs.to_uint32() & 0x1F
}

/// <https://tc39.es/ecma262/#sec-tonumeric>
/// Represents ECMAScript numeric types, i.e. `Number` or `BigInt`, as defined by ToNumeric.
#[allow(dead_code)]
#[derive(Debug, PartialEq, Clone)]
pub enum Numeric<A: IVm> {
    Number(Number),
    BigInt(BigInt<A>),
}

impl<A: IVm> From<Numeric<A>> for Unpacked<A> {
    fn from(value: Numeric<A>) -> Self {
        match value {
            Numeric::Number(value) => Unpacked::Number(value),
            Numeric::BigInt(value) => Unpacked::BigInt(value),
        }
    }
}

impl<A: IVm> Neg for Numeric<A> {
    type Output = Self;

    fn neg(self) -> Self::Output {
        match self {
            Numeric::Number(value) => Numeric::Number(-value),
            Numeric::BigInt(value) => Numeric::BigInt(-value),
        }
    }
}

impl<A: IVm> Add for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn add(self, rhs: Self) -> Self::Output {
        self.zip(rhs, |a, b| a + b, |a, b| Ok(a + b))
    }
}

impl<A: IVm> Mul for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn mul(self, rhs: Self) -> Self::Output {
        self.zip(rhs, |a, b| a * b, |a, b| a * b)
    }
}

impl<A: IVm> Sub for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn sub(self, rhs: Self) -> Self::Output {
        self.zip(rhs, |a, b| a - b, |a, b| Ok(a - b))
    }
}

impl<A: IVm> Rem for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn rem(self, rhs: Self) -> Self::Output {
        self.zip(rhs, |a, b| a % b, |a, b| a % b)
    }
}

impl<A: IVm> Div for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn div(self, rhs: Self) -> Self::Output {
        self.zip(rhs, |a, b| a / b, |a, b| a / b)
    }
}

impl<A: IVm> BitAnd for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn bitand(self, rhs: Self) -> Self::Output {
        self.zip(
            rhs,
            |a, b| (a.to_int32() & b.to_int32()).into(),
            |a, b| Ok(a & b),
        )
    }
}

impl<A: IVm> BitOr for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn bitor(self, rhs: Self) -> Self::Output {
        self.zip(
            rhs,
            |a, b| (a.to_int32() | b.to_int32()).into(),
            |a, b| Ok(a | b),
        )
    }
}

impl<A: IVm> BitXor for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn bitxor(self, rhs: Self) -> Self::Output {
        self.zip(
            rhs,
            |a, b| (a.to_int32() ^ b.to_int32()).into(),
            |a, b| Ok(a ^ b),
        )
    }
}

impl<A: IVm> Shl for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn shl(self, rhs: Self) -> Self::Output {
        self.zip(
            rhs,
            |a, b| (a.to_int32() << shift_count(b)).into(),
            |a, b| a << b,
        )
    }
}

impl<A: IVm> Shr for Numeric<A> {
    type Output = Result<Self, Any<A>>;

    fn shr(self, rhs: Self) -> Self::Output {
        self.zip(
            rhs,
            |a, b| (a.to_int32() >> shift_count(b)).into(),
            |a, b| a >> b,
        )
    }
}

impl<A: IVm> Numeric<A> {
    /// The mixed-operand rule every binary operator shares: two `Number`s
    /// combine through `number`, two `BigInt`s through `bigint`, and a
    /// `Number`/`BigInt` mix throws a `TypeError`.
    /// <https://tc39.es/ecma262/#sec-applystringornumericbinaryoperator>
    ///
    /// Only the `BigInt` side may throw: `Number` arithmetic is total, while
    /// a `BigInt` result can be refused (a division by zero, a negative
    /// exponent, a result too large to hold).
    fn zip(
        self,
        rhs: Self,
        number: impl FnOnce(Number, Number) -> Number,
        bigint: impl FnOnce(BigInt<A>, BigInt<A>) -> Result<BigInt<A>, Any<A>>,
    ) -> Result<Self, Any<A>> {
        match (self, rhs) {
            (Numeric::Number(a), Numeric::Number(b)) => Ok(Numeric::Number(number(a, b))),
            (Numeric::BigInt(a), Numeric::BigInt(b)) => Ok(Numeric::BigInt(bigint(a, b)?)),
            _ => Err(error::mixed_numeric_operands()),
        }
    }

    /// `**`. Not a `core::ops` trait — Rust has no operator for
    /// exponentiation, so this is a plain method, the same as `Any::pow`
    /// one level up.
    pub fn pow(self, rhs: Self) -> Result<Self, Any<A>> {
        self.zip(rhs, |a, b| a.pow(b), |a, b| a.pow(b))
    }

    /// `~`. Not a `core::ops` trait — `Not` is already claimed by `Any`'s
    /// logical `!` one level up — so this is a plain method, the same as
    /// `pow`. Number: `ToInt32` then bitwise-negate. BigInt: `-x - 1`, the
    /// exact spec identity (`BigInt::unaryMinus`/`Number::subtract` on the
    /// existing `Neg`/`Sub` impls), reusing them instead of a new
    /// two's-complement algorithm.
    pub fn bitwise_not(self) -> Self {
        match self {
            Numeric::Number(v) => Numeric::Number((!v.to_int32()).into()),
            Numeric::BigInt(v) => Numeric::BigInt(-v - BigInt::from(1u64)),
        }
    }

    /// `>>>`. Not a `core::ops` trait — Rust has no unsigned-right-shift
    /// operator, so this is a plain method, the same as `pow`/`bitwise_not`.
    /// Number: `ToUint32` both sides (unlike `<<`/`>>`'s `ToInt32` on the
    /// left — this is the one shift whose left operand's sign bit is never
    /// preserved), then a logical (zero-filling) shift. BigInt: always
    /// throws — arbitrary-precision integers have no fixed width for an
    /// "unsigned" shift to be relative to.
    pub fn unsigned_right_shift(self, rhs: Self) -> Result<Self, Any<A>> {
        self.zip(
            rhs,
            |a, b| (a.to_uint32() >> shift_count(b)).into(),
            |_, _| Err(error::bigint_unsigned_right_shift()),
        )
    }
}
