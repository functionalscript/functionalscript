mod add;
mod debug;
mod div;
mod from;
mod mul;
mod neg;
mod rem;
mod sub;

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
#[derive(Clone, Copy, PartialEq)]
pub struct Number(f64);

impl Number {
    /// The one `NaN`: quiet, positive, empty payload.
    pub const NAN: Self = Self(f64::from_bits(0x7ff8_0000_0000_0000));
}

#[cfg(test)]
mod tests {
    use super::Number;
    use crate::{
        naive::Naive,
        vm::{Any, ToAny, Unpacked, numeric::Numeric, primitive::Primitive},
    };

    pub(super) fn bits(v: Number) -> u64 {
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
            assert_eq!(bits(v.into()), bits(Number::NAN));
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

    /// The paths a number takes into a VM value all go through `Number`: a
    /// bare `f64`, a `Numeric`, a `Primitive`, and an operator on `Any`.
    #[test]
    fn every_way_in_canonicalizes() {
        let unpacked_bits = |v: Unpacked<Naive>| match v {
            Unpacked::Number(n) => bits(n),
            _ => panic!("a number"),
        };
        let nan = -f64::NAN;
        assert_ne!(nan.to_bits(), bits(Number::NAN));
        assert_eq!(
            unpacked_bits(nan.to_any::<Naive>().into()),
            bits(Number::NAN)
        );
        assert_eq!(
            unpacked_bits(Numeric::<Naive>::Number(nan.into()).into()),
            bits(Number::NAN)
        );
        assert_eq!(
            unpacked_bits(Primitive::<Naive>::Number(nan.into()).into()),
            bits(Number::NAN)
        );
        let negated: Any<Naive> = (-f64::NAN.to_any::<Naive>()).unwrap();
        assert_eq!(unpacked_bits(negated.into()), bits(Number::NAN));
    }
}
