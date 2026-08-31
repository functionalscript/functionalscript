use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{BigInt, IContainer, IVm},
};
use core::fmt::{Display, Formatter, Result, Write};

const DECIMAL_BASE: u64 = 10_000_000_000_000_000_000;

impl<A: IVm> Display for BigInt<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        if self.is_zero() {
            return f.write_char('0');
        }
        if self.sign() == Sign::Negative {
            f.write_char('-')?;
        }

        let items = self.0.items();
        let mut words: Vec<u64> = (0..items.length()).map(|i| items[i]).collect();
        let mut groups = Vec::new();
        while !words.is_empty() {
            let mut remainder = 0u128;
            for word in words.iter_mut().rev() {
                let dividend = (remainder << 64) | *word as u128;
                *word = (dividend / DECIMAL_BASE as u128) as u64;
                remainder = dividend % DECIMAL_BASE as u128;
            }
            groups.push(remainder as u64);
            while words.last() == Some(&0) {
                words.pop();
            }
        }

        write!(f, "{}", groups.pop().unwrap())?;
        for group in groups.iter().rev() {
            write!(f, "{group:019}")?;
        }
        Ok(())
    }
}
