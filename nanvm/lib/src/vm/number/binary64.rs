//! The IEEE 754 binary64 layout of a [`Number`], in one place: a sign bit,
//! an 11-bit biased exponent and a 52-bit fraction. [`Number::decompose`]
//! reads a finite value as `±significand · 2^exponent`, and
//! [`Number::compose`] rounds such a value, of any width, back to the
//! nearest `Number`.

use super::Number;
use crate::sign::Sign;

/// The width of the fraction field: the significand bits stored under the
/// implicit leading one.
const FRACTION_BITS: u32 = 52;

/// The fraction field.
const FRACTION_MASK: u64 = 0xf_ffff_ffff_ffff;

/// The biased exponent field, once the fraction is shifted away. All ones
/// is an infinity or a `NaN`.
const EXPONENT_MASK: u64 = 0x7ff;

/// The sign bit.
const SIGN_BIT: u64 = 0x8000_0000_0000_0000;

/// The leading bit of a normal value's significand, which the format
/// implies rather than stores.
const IMPLICIT_BIT: u64 = 0x10_0000_0000_0000;

/// The number of significand bits a `Number` holds: the fraction and the
/// implicit bit.
const PRECISION: u32 = FRACTION_BITS + 1;

/// What the biased exponent field exceeds the exponent of the significand's
/// lowest bit by: the format's bias of 1023 plus the 52 fraction bits, as
/// the significand is read as an integer.
const BIAS: i32 = 1_075;

/// The exponent of the significand's lowest bit for a biased exponent of
/// zero or one: a subnormal's, and the smallest normal's. `2^-1074` is the
/// smallest positive `Number`.
const MIN_EXPONENT: i32 = 1 - BIAS;

impl Number {
    /// `self` as `±significand · 2^exponent`, exactly: a normal value's
    /// `significand` has the implicit leading bit folded in, a subnormal's
    /// is the fraction as it is, and both zeros are a `0` significand with
    /// their own sign. `None` for a `NaN` and the infinities.
    ///
    /// Not reduced to lowest terms: `significand` may end in zero bits.
    pub fn decompose(self) -> Option<(Sign, u64, i32)> {
        let bits = self.0.to_bits();
        let sign = if bits & SIGN_BIT == 0 {
            Sign::Positive
        } else {
            Sign::Negative
        };
        let biased = (bits >> FRACTION_BITS) & EXPONENT_MASK;
        let fraction = bits & FRACTION_MASK;
        match biased {
            EXPONENT_MASK => None,
            0 => Some((sign, fraction, MIN_EXPONENT)),
            _ => Some((sign, fraction | IMPLICIT_BIT, biased as i32 - BIAS)),
        }
    }

    /// `±significand · 2^exponent` rounded to the nearest `Number`, a tie
    /// going to the even significand: subnormal under the normal range, an
    /// infinity past it, and a zero of `sign`'s sign for a `0` significand.
    ///
    /// `sticky` says the exact value is a little more than that: some bit
    /// under `significand`'s lowest is set. It can only break a tie upward,
    /// so it needs a rounded-away bit of `significand` above it to say where
    /// the half is. With 53 significant bits or fewer the extra could be as
    /// much as a whole unit of the result, so that call is refused with
    /// `None`, in every build: the types can't carry the precondition.
    pub(crate) fn compose(
        sign: Sign,
        significand: u128,
        exponent: i32,
        sticky: bool,
    ) -> Option<Self> {
        if sticky && significand >> PRECISION == 0 {
            return None;
        }
        let sign_bit = match sign {
            Sign::Positive => 0,
            Sign::Negative => SIGN_BIT,
        };
        if significand == 0 {
            return Some(Number(f64::from_bits(sign_bit)));
        }
        let width = 128 - significand.leading_zeros();
        // The exponent of the result's lowest significand bit: `PRECISION`
        // bits under the top of `significand`, but never under a
        // subnormal's.
        let unit = (i64::from(exponent) + i64::from(width) - i64::from(PRECISION))
            .max(i64::from(MIN_EXPONENT));
        // How many of `significand`'s low bits the result has no room for.
        let dropped = unit - i64::from(exponent);
        let kept = if dropped <= 0 {
            // Exact: `significand` fits, at most `PRECISION` bits once
            // shifted up to `unit`.
            (significand << dropped.unsigned_abs()) as u64
        } else {
            let dropped = u32::try_from(dropped).unwrap_or(u32::MAX);
            let kept = significand.checked_shr(dropped).unwrap_or(0) as u64;
            let remainder = if dropped < 128 {
                significand & ((1 << dropped) - 1)
            } else {
                significand
            };
            // `half` is the weight of the highest dropped bit; past 128 bits
            // it exceeds every `remainder`.
            let round_up = 1u128.checked_shl(dropped - 1).is_some_and(|half| {
                remainder > half || (remainder == half && (sticky || kept & 1 != 0))
            });
            kept + u64::from(round_up)
        };
        // Rounding up all ones carries out of the significand: one bit
        // fewer, one exponent higher, the same value.
        let (kept, unit) = if kept >> PRECISION != 0 {
            (kept >> 1, unit + 1)
        } else {
            (kept, unit)
        };
        let magnitude = if kept < IMPLICIT_BIT {
            // Subnormal, or rounded down to zero: `unit` is `MIN_EXPONENT`,
            // and the biased exponent is `0`.
            kept
        } else {
            let biased = unit + i64::from(BIAS);
            if biased >= EXPONENT_MASK as i64 {
                EXPONENT_MASK << FRACTION_BITS
            } else {
                ((biased as u64) << FRACTION_BITS) | (kept & FRACTION_MASK)
            }
        };
        Some(Number(f64::from_bits(sign_bit | magnitude)))
    }
}

#[cfg(test)]
mod tests {
    use crate::{sign::Sign, vm::Number};

    fn decompose(v: f64) -> Option<(Sign, u64, i32)> {
        Number::from(v).decompose()
    }

    fn compose(significand: u128, exponent: i32, sticky: bool) -> f64 {
        Number::compose(Sign::Positive, significand, exponent, sticky)
            .unwrap()
            .into()
    }

    /// Every value `decompose` reads, `compose` rebuilds bit for bit.
    fn round_trip(v: f64) {
        let (sign, significand, exponent) = decompose(v).unwrap();
        let back =
            f64::from(Number::compose(sign, u128::from(significand), exponent, false).unwrap());
        assert_eq!(back.to_bits(), v.to_bits(), "{v:e}");
    }

    #[test]
    fn decompose_normal() {
        assert_eq!(
            decompose(1.0),
            Some((Sign::Positive, 0x10_0000_0000_0000, -52))
        );
        assert_eq!(
            decompose(-1.5),
            Some((Sign::Negative, 0x18_0000_0000_0000, -52))
        );
        // 2^53: the first integer whose successor is not a `Number`.
        assert_eq!(
            decompose(9_007_199_254_740_992.0),
            Some((Sign::Positive, 0x10_0000_0000_0000, 1))
        );
        assert_eq!(
            decompose(f64::MAX),
            Some((Sign::Positive, 0x1f_ffff_ffff_ffff, 971))
        );
    }

    #[test]
    fn decompose_subnormal_boundary() {
        // The smallest normal: the implicit bit, at the subnormals' exponent.
        assert_eq!(
            decompose(f64::MIN_POSITIVE),
            Some((Sign::Positive, 0x10_0000_0000_0000, -1_074))
        );
        // The largest subnormal: no implicit bit, the same exponent.
        assert_eq!(
            decompose(f64::from_bits(0xf_ffff_ffff_ffff)),
            Some((Sign::Positive, 0xf_ffff_ffff_ffff, -1_074))
        );
        assert_eq!(
            decompose(f64::from_bits(1)),
            Some((Sign::Positive, 1, -1_074))
        );
        assert_eq!(decompose(0.0), Some((Sign::Positive, 0, -1_074)));
        assert_eq!(decompose(-0.0), Some((Sign::Negative, 0, -1_074)));
    }

    #[test]
    fn decompose_not_finite() {
        assert_eq!(decompose(f64::INFINITY), None);
        assert_eq!(decompose(f64::NEG_INFINITY), None);
        assert_eq!(decompose(f64::NAN), None);
    }

    #[test]
    fn round_trips() {
        for v in [
            0.0,
            -0.0,
            1.0,
            -1.5,
            0.1,
            9_007_199_254_740_992.0,
            f64::MAX,
            -f64::MAX,
            f64::MIN_POSITIVE,
            f64::from_bits(0xf_ffff_ffff_ffff),
            f64::from_bits(1),
            -f64::from_bits(1),
        ] {
            round_trip(v);
        }
    }

    #[test]
    fn exact() {
        assert_eq!(compose(1, 0, false), 1.0);
        assert_eq!(compose(3, -1, false), 1.5);
        assert_eq!(compose(1 << 53, 0, false), 9_007_199_254_740_992.0);
        assert_eq!(compose(1 << 100, -100, false), 1.0);
        let zero = f64::from(Number::compose(Sign::Negative, 0, 5, false).unwrap());
        assert_eq!(zero.to_bits(), 0x8000_0000_0000_0000);
    }

    #[test]
    fn two_to_the_53_ties() {
        let two_53 = 9_007_199_254_740_992.0;
        // 2^53 + 1 is half way between 2^53 and 2^53 + 2: the even one.
        assert_eq!(compose((1 << 53) + 1, 0, false), two_53);
        // A sticky bit under it breaks the tie upward.
        assert_eq!(compose(((1 << 53) + 1) << 8, -8, true), two_53 + 2.0);
        // 2^53 + 3 is a tie whose even neighbor is the upper one.
        assert_eq!(compose((1 << 53) + 3, 0, false), two_53 + 4.0);
        // Under and over half round down and up: 2^53 + 0.5, 2^53 + 1.5.
        assert_eq!(compose((1 << 54) + 1, -1, false), two_53);
        assert_eq!(compose((1 << 54) + 3, -1, false), two_53 + 2.0);
    }

    #[test]
    fn carry_out_of_the_significand() {
        // 54 ones round up to 2^54: the significand overflows into the
        // exponent.
        assert_eq!(compose((1 << 54) - 1, 0, false), 18_014_398_509_481_984.0);
        // 0b1111111101110111011101101101011011010110110100010000011, the
        // 55-bit literal `number_coercion`'s tests pin: its two dropped
        // bits are over half.
        assert_eq!(
            compose(0x7f_bbbb_6b6b_6883, 0, false),
            35_953_735_677_732_996.0
        );
    }

    #[test]
    fn overflow() {
        // Just under 2^1024 rounds up to it: Infinity.
        assert_eq!(compose((1 << 54) - 1, 970, false), f64::INFINITY);
        // 53 ones at the top exponent is the largest finite value.
        assert_eq!(compose((1 << 53) - 1, 971, false), f64::MAX);
        assert_eq!(compose(1, 1_024, false), f64::INFINITY);
        assert_eq!(compose(1, i32::MAX, false), f64::INFINITY);
        assert_eq!(compose(u128::MAX, i32::MAX, true), f64::INFINITY);
        let negative = f64::from(Number::compose(Sign::Negative, 1, 1_024, false).unwrap());
        assert_eq!(negative, f64::NEG_INFINITY);
    }

    /// A sticky bit under 53 significant bits or fewer has no rounded-away
    /// bit to place the half, so the call is refused.
    #[test]
    fn narrow_sticky_refused() {
        assert_eq!(Number::compose(Sign::Positive, 1, -1_074, true), None);
        assert_eq!(Number::compose(Sign::Positive, 0, 0, true), None);
        assert_eq!(
            Number::compose(Sign::Positive, (1 << 53) - 1, 0, true),
            None
        );
        assert!(Number::compose(Sign::Positive, 1 << 53, 0, true).is_some());
    }

    #[test]
    fn subnormal() {
        let min = f64::from_bits(1);
        assert_eq!(compose(1, -1_074, false), min);
        assert_eq!(compose(1 << 60, -1_134, false), min);
        // Half the smallest subnormal is a tie with zero: zero is even.
        assert_eq!(compose(1, -1_075, false), 0.0);
        // A sticky bit under it rounds up.
        assert_eq!(compose(1 << 60, -1_135, true), min);
        // Three halves is a tie between one and two: two is even.
        assert_eq!(compose(3, -1_075, false), f64::from_bits(2));
        assert_eq!(compose(1, i32::MIN, false), 0.0);
        // The largest subnormal plus a half rounds up into the normals.
        assert_eq!(
            compose(0x1f_ffff_ffff_ffff, -1_075, false),
            f64::MIN_POSITIVE
        );
        // A subnormal significand at a normal exponent is a normal value.
        assert_eq!(compose(1, -1_022, false), f64::MIN_POSITIVE);
    }

    /// Rust's own `u128 as f64` rounds to nearest even too: over widths up
    /// to 128 bits and exponents scaling it by an exact power of two,
    /// `compose` agrees with it.
    #[test]
    fn agrees_with_u128_as_f64() {
        let mut state = 0x9e37_79b9_7f4a_7c15u64;
        let mut next = || {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            state
        };
        for _ in 0..10_000 {
            let wide = (u128::from(next()) << 64) | u128::from(next());
            let significand = wide >> (next() % 128);
            let exponent = (next() % 1_601) as i32 - 800;
            let expected = (significand as f64) * 2f64.powi(exponent);
            assert_eq!(
                compose(significand, exponent, false),
                expected,
                "{significand:#x}"
            );
        }
    }
}
