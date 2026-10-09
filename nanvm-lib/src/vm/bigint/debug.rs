use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{BigInt, IContainer, IVm},
};
use core::fmt::{Debug, Formatter, Result, Write};

impl<A: IVm> Debug for BigInt<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        if self.is_zero() {
            return f.write_str("0n");
        }
        if self.sign() == Sign::Negative {
            f.write_char('-')?;
        }
        f.write_str("0x")?;
        let items = self.0.items();
        // Most significant word first and unpadded, then `_` and sixteen
        // digits per word. Not `ContainerFmt`'s delimited loop: through a
        // shared separator helper, the per-word closure would repeat the
        // helper's first-item test to choose the padding. The loop's twin is
        // `Display`'s decimal group join, which has no separator.
        let last = items.length() - 1;
        write!(f, "{:X}", items[last])?;
        for i in (0..last).rev() {
            write!(f, "_{:016X}", items[i])?;
        }
        f.write_char('n')
    }
}
