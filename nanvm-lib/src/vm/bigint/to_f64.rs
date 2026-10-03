use super::BigInt;
use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{IVm, Number},
};

impl<A: IVm> BigInt<A> {
    /// `Number(bigint)`: the nearest `Number`, a tie going to the even
    /// significand, and `Infinity` or `-Infinity` past the range.
    /// <https://tc39.es/ecma262/#sec-numberbigint>
    ///
    /// Up to 64 bits the conversion is Rust's own `u64 as f64`, which rounds
    /// to nearest even. Past that, the top 64 bits are converted the same way
    /// and the bits below them only decide a tie: any of them set is folded
    /// into the lowest of the 64, which sits more than two bits under the
    /// 53 the significand keeps, so it breaks a tie upward and can do
    /// nothing else. The rest is a power of two, exact until it overflows.
    pub fn to_number(&self) -> Number {
        let length = self.length();
        let magnitude = if length == 0 {
            0.0
        } else {
            let top = self[length - 1];
            let zeros = top.leading_zeros();
            // The top 64 bits of the magnitude, and what lies below them.
            let (head, below) = if length == 1 {
                (top << zeros, 0)
            } else {
                let next = self[length - 2];
                let head = if zeros == 0 {
                    top
                } else {
                    (top << zeros) | (next >> (64 - zeros))
                };
                let rest = if zeros == 0 { next } else { next << zeros };
                let lower = (0..length - 2).any(|i| self[i] != 0);
                (head, rest | u64::from(lower))
            };
            // `head`'s lowest bit takes the sticky bit; `length == 1` shifted
            // the word up, so its low bits are zeros and `below` is `0`.
            let bits = 64 * (length - 1) + (64 - zeros);
            let value = (head | u64::from(below != 0)) as f64;
            let exponent = i32::try_from(bits).map_or(i32::MAX, |b| b - 64);
            value * 2f64.powi(exponent)
        };
        Number::from(if self.sign() == Sign::Negative {
            -magnitude
        } else {
            magnitude
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        sign::Sign,
        vm::{BigInt, Number},
    };

    fn n(sign: Sign, words: &[u64]) -> f64 {
        f64::from(BigInt::<Naive>::normalize_new(sign, words.iter().copied()).to_number())
    }

    fn pos(words: &[u64]) -> f64 {
        n(Sign::Positive, words)
    }

    #[test]
    fn small() {
        assert_eq!(pos(&[]), 0.0);
        assert!(pos(&[]).is_sign_positive());
        assert!(n(Sign::Negative, &[]).is_sign_positive());
        assert_eq!(pos(&[1]), 1.0);
        assert_eq!(n(Sign::Negative, &[1]), -1.0);
        assert_eq!(pos(&[u64::MAX]), u64::MAX as f64);
    }

    #[test]
    fn two_to_the_53() {
        assert_eq!(pos(&[1 << 53]), 9007199254740992.0);
        // 2^53 + 1 is a tie between 2^53 and 2^53 + 2: the even one.
        assert_eq!(pos(&[(1 << 53) + 1]), 9007199254740992.0);
        // 2^53 + 3 is a tie too, and the even significand is the upper one.
        assert_eq!(pos(&[(1 << 53) + 3]), 9007199254740996.0);
    }

    #[test]
    fn sticky_bits_break_a_tie() {
        // 2^64 + 2^11 is half way between 2^64 and 2^64 + 2^12: a tie, even
        // is 2^64. One more bit anywhere below goes up.
        let two_64 = 18446744073709551616.0;
        assert_eq!(pos(&[1 << 11, 1]), two_64);
        assert_eq!(pos(&[(1 << 11) + 1, 1]), two_64 + 4096.0);
        // The same with the extra bit two words down.
        assert_eq!(pos(&[1, 1 << 11, 1]), two_64 * two_64 + two_64 * 4096.0);
        assert_eq!(pos(&[0, 1 << 11, 1]), two_64 * two_64);
    }

    #[test]
    fn several_words() {
        // 123456789012345678901234567890n
        assert_eq!(
            pos(&[0xC373E0EE4E3F0AD2, 0x18EE90FF6]),
            123456789012345678901234567890.0
        );
        assert_eq!(pos(&[0, 1]), 18446744073709551616.0);
        assert_eq!(pos(&[0, 0, 1]), 340282366920938463463374607431768211456.0);
    }

    #[test]
    fn range() {
        // 2^1023 words: bit 1023 is bit 63 of word 15.
        let mut words = vec![0u64; 16];
        words[15] = 1 << 63;
        assert_eq!(pos(&words), 2f64.powi(1023));
        // Just under 2^1024 rounds up to it: Infinity.
        let all = vec![u64::MAX; 16];
        assert_eq!(pos(&all), f64::INFINITY);
        assert_eq!(n(Sign::Negative, &all), f64::NEG_INFINITY);
        // The largest finite value: 53 ones, then zeros.
        let mut words = vec![0u64; 16];
        words[15] = u64::MAX << 11;
        assert_eq!(pos(&words), f64::MAX);
        // Past the range by words.
        assert_eq!(pos(&vec![1u64; 40]), f64::INFINITY);
    }

    #[test]
    fn never_nan() {
        let v: Number = BigInt::<Naive>::normalize_new(Sign::Positive, [0u64; 3]).to_number();
        assert_eq!(f64::from(v), 0.0);
    }
}
