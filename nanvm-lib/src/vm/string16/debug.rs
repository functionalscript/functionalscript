use crate::vm::{IVm, String16};
use core::fmt::{Debug, Formatter, Write};
use std::ops::RangeInclusive;

const DOUBLE_QUOTE: u16 = '"' as u16;
const BACKSLASH: u16 = '\\' as u16;
const PRINTABLE_ASCII: RangeInclusive<u16> = 0x20..=0x7F;

impl<A: IVm> Debug for String16<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_char('"')?;
        for i in self.clone().into_iter() {
            match i {
                DOUBLE_QUOTE => f.write_str("\\\"")?,
                BACKSLASH => f.write_str("\\\\")?,
                c => {
                    if PRINTABLE_ASCII.contains(&c) {
                        f.write_char(c as u8 as char)?;
                    } else {
                        write!(f, "\\u{c:04X}")?;
                    }
                }
            }
        }
        f.write_char('"')
    }
}
