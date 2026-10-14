use super::radix::chunk;
use crate::{
    sign::Sign,
    vm::{BigInt, IVm},
};
use core::fmt::{Display, Formatter, Result, Write};

impl<A: IVm> Display for BigInt<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        if self.is_zero() {
            return f.write_char('0');
        }
        if self.sign() == Sign::Negative {
            f.write_char('-')?;
        }

        let (base, width) = chunk(10);
        let mut chunks = self.chunks(base);
        write!(f, "{}", chunks.pop().unwrap())?;
        for c in chunks.iter().rev() {
            write!(f, "{c:0width$}")?;
        }
        Ok(())
    }
}
