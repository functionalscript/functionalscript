use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{BigInt, IContainer, IVm},
};

impl<A: IVm> BigInt<A> {
    /// The integer's digits in `radix`, `2` to `36`, `0-9` then `a-z`, a
    /// `-` first when negative: `Number::toString` and `BigInt::toString`
    /// with a radix (<https://tc39.es/ecma262/#sec-numeric-types-bigint-tostring>),
    /// which ECMAScript specifies exactly for an integer. The words are
    /// divided by `radix` until none is left, as `Display` divides by a
    /// power of ten.
    pub(crate) fn to_radix_string(&self, radix: u32) -> std::string::String {
        assert!((2..=36).contains(&radix), "a radix is 2 to 36");
        if self.is_zero() {
            return "0".into();
        }
        let items = self.0.items();
        let mut words: Vec<u64> = (0..items.length()).map(|i| items[i]).collect();
        let mut digits = Vec::new();
        while !words.is_empty() {
            let mut remainder = 0u128;
            for word in words.iter_mut().rev() {
                let dividend = (remainder << 64) | *word as u128;
                *word = (dividend / u128::from(radix)) as u64;
                remainder = dividend % u128::from(radix);
            }
            digits
                .push(char::from_digit(remainder as u32, radix).expect("a digit below the radix"));
            while words.last() == Some(&0) {
                words.pop();
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
    }
}
