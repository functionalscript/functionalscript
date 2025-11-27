use crate::{
    common::sized_index::SizedIndex,
    vm::{Function, IContainer, IVm},
};
use core::fmt::{Debug, Formatter, Result, Write};

impl<A: IVm> Debug for Function<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        let name: String = self.name().clone().into();
        write!(f, "function {name}(")?;
        for i in 0..self.length() {
            if i != 0 {
                f.write_char(',')?;
            }
            write!(f, "a{i}")?;
        }
        f.write_str(") {")?;
        let items = self.0.items();
        for i in 0..items.length() {
            write!(f, "{:02X}", items[i])?;
        }
        f.write_char('}')
    }
}
