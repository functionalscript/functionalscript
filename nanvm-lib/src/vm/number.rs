use core::ops::{Add, Div, Mul, Neg, Rem, Sub};

/// The bits of the one `NaN`: quiet, positive, empty payload.
const CANONICAL_NAN: u64 = 0x7ff8_0000_0000_0000;

/// A JavaScript number: an `f64` that holds one `NaN`.
///
/// FunctionalScript has one `NaN`: nothing in the language tells two apart,
/// so a sign or payload a host operation left on one — `-NaN` flips the
/// sign, x86's `0 / 0` sets it — is dropped where an `f64` becomes a
/// `Number`, and every operator's result passes back through the same
/// conversion. The field is private, so there is no other way to build one,
/// and a NaN-boxing VM, which keeps its boxed values in the negative quiet
/// `NaN`s, can store the bits as they are.
#[repr(transparent)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Number(f64);

impl From<f64> for Number {
    fn from(v: f64) -> Self {
        Number(if v.is_nan() {
            f64::from_bits(CANONICAL_NAN)
        } else {
            v
        })
    }
}

impl From<Number> for f64 {
    fn from(v: Number) -> Self {
        v.0
    }
}

/// Exact: every `i32` is an `f64`. `ToInt32`'s results come back this way.
impl From<i32> for Number {
    fn from(v: i32) -> Self {
        Number(v as f64)
    }
}

/// Exact: every `u32` is an `f64`. `ToUint32`'s results come back this way.
impl From<u32> for Number {
    fn from(v: u32) -> Self {
        Number(v as f64)
    }
}

impl Neg for Number {
    type Output = Self;
    fn neg(self) -> Self {
        (-self.0).into()
    }
}

impl Add for Number {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        (self.0 + rhs.0).into()
    }
}

impl Sub for Number {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self {
        (self.0 - rhs.0).into()
    }
}

impl Mul for Number {
    type Output = Self;
    fn mul(self, rhs: Self) -> Self {
        (self.0 * rhs.0).into()
    }
}

impl Div for Number {
    type Output = Self;
    fn div(self, rhs: Self) -> Self {
        (self.0 / rhs.0).into()
    }
}

impl Rem for Number {
    type Output = Self;
    fn rem(self, rhs: Self) -> Self {
        (self.0 % rhs.0).into()
    }
}

#[cfg(test)]
mod test {
    use super::{CANONICAL_NAN, Number};
    use crate::{
        naive::Naive,
        vm::{Any, ToAny, Unpacked, numeric::Numeric, primitive::Primitive},
    };

    fn bits(v: Number) -> u64 {
        f64::from(v).to_bits()
    }

    /// Every `NaN` a host can hand over — the sign flipped, a payload set,
    /// a signaling one — is the canonical `NaN` once it is a `Number`.
    #[test]
    fn every_nan_is_the_canonical_one() {
        for v in [
            f64::NAN,
            -f64::NAN,
            f64::from_bits(0x7ff8_0000_0000_0001),
            f64::from_bits(0xfff8_0000_0000_0001),
            f64::from_bits(0x7ff0_0000_0000_0001),
        ] {
            assert!(v.is_nan());
            assert_eq!(bits(v.into()), CANONICAL_NAN);
        }
    }

    /// Only a `NaN` is touched: `-0` keeps its sign, and every other bit
    /// pattern is passed through as it came, and comes back the same.
    #[test]
    fn other_numbers_keep_their_bits() {
        for v in [
            0.0,
            -0.0,
            1.5,
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::MIN_POSITIVE,
            f64::from_bits(1),
        ] {
            assert_eq!(bits(v.into()), v.to_bits());
        }
    }

    /// An operator's result is canonical too: `-NaN`, the program the sign
    /// flip comes from, and `0 / 0`, which x86 answers with a negative
    /// `NaN`.
    #[test]
    fn operators_canonicalize() {
        let nan = Number::from(f64::NAN);
        let zero = Number::from(0.0);
        assert_eq!(bits(-nan), CANONICAL_NAN);
        assert_eq!(bits(zero / zero), CANONICAL_NAN);
        assert_eq!(bits(nan + zero), CANONICAL_NAN);
        assert_eq!(bits(Number::from(-1) * zero), (-0.0f64).to_bits());
    }

    /// The paths a number takes into a VM value all go through `Number`: a
    /// bare `f64`, a `Numeric`, a `Primitive`, and an operator on `Any`.
    #[test]
    fn every_way_in_canonicalizes() {
        let unpacked_bits = |v: Unpacked<Naive>| match v {
            Unpacked::Number(n) => bits(n),
            _ => panic!("a number"),
        };
        let nan = -f64::NAN;
        assert_ne!(nan.to_bits(), CANONICAL_NAN);
        assert_eq!(unpacked_bits(nan.to_any::<Naive>().into()), CANONICAL_NAN);
        assert_eq!(
            unpacked_bits(Numeric::<Naive>::Number(nan.into()).into()),
            CANONICAL_NAN
        );
        assert_eq!(
            unpacked_bits(Primitive::<Naive>::Number(nan.into()).into()),
            CANONICAL_NAN
        );
        let negated: Any<Naive> = (-f64::NAN.to_any::<Naive>()).unwrap();
        assert_eq!(unpacked_bits(negated.into()), CANONICAL_NAN);
    }
}
