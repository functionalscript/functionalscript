use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{BigInt, IContainer, IVm},
};

use super::trim;

impl<A: IVm> BigInt<A> {
    /// The integer's digits in `radix`, `2` to `36`, `0-9` then `a-z`, a
    /// `-` first when negative: `Number::toString` and `BigInt::toString`
    /// with a radix (<https://tc39.es/ecma262/#sec-numeric-types-bigint-tostring>),
    /// which ECMAScript specifies exactly for an integer. The digits are
    /// read a chunk at a time, the [`chunks`](Self::chunks) in the largest
    /// power of `radix` a word holds, as `Display` reads them in `10¹⁹`.
    pub(crate) fn to_radix_string(&self, radix: u32) -> std::string::String {
        assert!((2..=36).contains(&radix), "a radix is 2 to 36");
        if self.is_zero() {
            return "0".into();
        }
        let (base, width) = chunk(radix);
        let chunks = self.chunks(base);
        let top = chunks.len() - 1;
        let mut digits = Vec::new();
        for (i, mut r) in chunks.into_iter().enumerate() {
            // Every chunk but the most significant is `width` digits wide,
            // its leading zeros included.
            for _ in 0..width {
                if i == top && r == 0 {
                    break;
                }
                let d = (r % u64::from(radix)) as u32;
                digits.push(char::from_digit(d, radix).expect("a digit below the radix"));
                r /= u64::from(radix);
            }
        }
        let sign = if self.sign() == Sign::Negative {
            "-"
        } else {
            ""
        };
        format!(
            "{sign}{}",
            digits.iter().rev().collect::<std::string::String>()
        )
    }

    /// The magnitude in `base`, least significant chunk first: the
    /// remainders of dividing the words by `base` until none is left. The
    /// most significant chunk is never `0`; a zero magnitude has no chunks.
    pub(super) fn chunks(&self, base: u64) -> Vec<u64> {
        let items = self.0.items();
        let mut words: Vec<u64> = (0..items.length()).map(|i| items[i]).collect();
        let mut chunks = Vec::new();
        while !words.is_empty() {
            let mut remainder = 0u128;
            for word in words.iter_mut().rev() {
                let dividend = (remainder << 64) | *word as u128;
                *word = (dividend / u128::from(base)) as u64;
                remainder = dividend % u128::from(base);
            }
            chunks.push(remainder as u64);
            trim(&mut words);
        }
        chunks
    }
}

/// The largest power of `radix` a `u64` holds, and how many digits it has.
pub(super) fn chunk(radix: u32) -> (u64, usize) {
    let radix = u64::from(radix);
    let mut base = radix;
    let mut width = 1;
    while let Some(next) = base.checked_mul(radix) {
        base = next;
        width += 1;
    }
    (base, width)
}

#[cfg(test)]
mod tests {
    use crate::{naive::Naive, vm::BigInt};

    type A = Naive;

    #[test]
    fn radixes() {
        let b = |v: i64| BigInt::<A>::from(v);
        assert_eq!(b(255).to_radix_string(16), "ff");
        assert_eq!(b(-255).to_radix_string(2), "-11111111");
        assert_eq!(b(-255).to_radix_string(36), "-73");
        assert_eq!(b(0).to_radix_string(2), "0");
        assert_eq!(b(35).to_radix_string(36), "z");
        let big = (b(1) << b(100)).unwrap();
        assert_eq!(big.to_radix_string(16), format!("1{}", "0".repeat(25)));
        assert_eq!(big.to_radix_string(10), big.to_string());
        // Zeros inside a chunk, and chunks of zeros, are digits too.
        let wide = (b(1) << b(1_000)).unwrap();
        assert_eq!(wide.to_radix_string(2), format!("1{}", "0".repeat(1_000)));
        assert_eq!(wide.to_radix_string(10), wide.to_string());
        assert_eq!(b(36 * 36 * 36).to_radix_string(36), "1000");
        assert_eq!(
            b(36i64.pow(12)).to_radix_string(36),
            format!("1{}", "0".repeat(12))
        );
    }

    #[test]
    fn unpadded_top_chunk() {
        // Only the most significant chunk drops its leading zeros.
        let b = |v: u64| BigInt::<A>::from(v);
        for (v, s) in [
            (255, "255"),
            (10_000_000_000_000_000_005, "10000000000000000005"),
        ] {
            assert_eq!(b(v).to_string(), s);
            assert_eq!(b(v).to_radix_string(10), s);
        }
    }

    #[test]
    fn chunks() {
        assert_eq!(super::chunk(2), (1 << 63, 63));
        assert_eq!(super::chunk(10), (10_000_000_000_000_000_000, 19));
        assert_eq!(super::chunk(36), (36u64.pow(12), 12));
    }
}
