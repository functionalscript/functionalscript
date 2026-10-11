use core::fmt::{Debug, Formatter, Result, Write};

use crate::common::sized_index::SizedIndex;

pub trait ContainerFmt {
    fn container_fmt(&self, open: char, close: char, f: &mut Formatter<'_>) -> Result
    where
        Self: SizedIndex<u32, Output: Debug>,
    {
        f.write_char(open)?;
        for i in 0..self.length() {
            if i != 0 {
                f.write_char(',')?;
            }
            self[i].fmt(f)?;
        }
        f.write_char(close)
    }
}

impl<T> ContainerFmt for T {}
