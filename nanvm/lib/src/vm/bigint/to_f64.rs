use super::BigInt;
use crate::{
    common::sized_index::SizedIndex,
    vm::{IVm, Number},
};

impl<A: IVm> BigInt<A> {
    /// `Number(bigint)`: the nearest `Number`, a tie going to the even
    /// significand, and `Infinity` or `-Infinity` past the range.
    /// <https://tc39.es/ecma262/#sec-numberbigint>
    ///
    /// The top two words are the significand [`Number::compose`] rounds, and
    /// any word below them set is its sticky bit: with the top word not
    /// zero, the two hold at least 65 significant bits, more than the 54 the
    /// sticky bit needs.
    pub fn to_number(&self) -> Number {
        let length = self.length();
        let (significand, words_below, sticky) = match length {
            0 => (0, 0, false),
            1 => (u128::from(self[0]), 0, false),
            _ => (
                (u128::from(self[length - 1]) << 64) | u128::from(self[length - 2]),
                length - 2,
                (0..length - 2).any(|i| self[i] != 0),
            ),
        };
        let exponent =
            i32::try_from(64 * words_below).expect("a BigInt's words are far under 2^31 bits");
        Number::compose(self.sign(), significand, exponent, sticky)
            .expect("`sticky` is set only under a nonzero top word: over 64 significant bits")
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
        assert_eq!(pos(&[1 << 53]), 9_007_199_254_740_992.0);
        // 2^53 + 1 is a tie between 2^53 and 2^53 + 2: the even one.
        assert_eq!(pos(&[(1 << 53) + 1]), 9_007_199_254_740_992.0);
        // 2^53 + 3 is a tie too, and the even significand is the upper one.
        assert_eq!(pos(&[(1 << 53) + 3]), 9_007_199_254_740_996.0);
    }

    #[test]
    fn sticky_bits_break_a_tie() {
        // 2^64 + 2^11 is half way between 2^64 and 2^64 + 2^12: a tie, even
        // is 2^64. One more bit anywhere below goes up.
        let two_64 = 18_446_744_073_709_551_616.0;
        assert_eq!(pos(&[1 << 11, 1]), two_64);
        assert_eq!(pos(&[(1 << 11) + 1, 1]), two_64 + 4_096.0);
        // The same with the extra bit two words down.
        assert_eq!(pos(&[1, 1 << 11, 1]), two_64 * two_64 + two_64 * 4_096.0);
        assert_eq!(pos(&[0, 1 << 11, 1]), two_64 * two_64);
    }

    #[test]
    fn several_words() {
        // 123456789012345678901234567890n
        assert_eq!(
            pos(&[0xC373_E0EE_4E3F_0AD2, 0x1_8EE9_0FF6]),
            123_456_789_012_345_678_901_234_567_890.0
        );
        assert_eq!(pos(&[0, 1]), 18_446_744_073_709_551_616.0);
        assert_eq!(
            pos(&[0, 0, 1]),
            340_282_366_920_938_463_463_374_607_431_768_211_456.0
        );
    }

    #[test]
    fn range() {
        // 2^1023 words: bit 1023 is bit 63 of word 15.
        let mut words = vec![0u64; 16];
        words[15] = 1 << 63;
        assert_eq!(pos(&words), 2f64.powi(1_023));
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
