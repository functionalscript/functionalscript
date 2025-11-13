use core::fmt::{self, Debug, Formatter, Write};

use crate::{
    common::array::{RandomAccess, SizedIndex},
    sign::Sign,
    vm::{Any, Array, BigInt, Function, IContainer, IVm, Object, String16, Unpacked},
};

impl<A: IVm> Debug for Any<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        self.0.clone().to_unpacked().fmt(f)
    }
}

impl<A: IVm> Debug for Array<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        self.0.items_fmt('[', ']', f)
    }
}

impl<A: IVm> Debug for BigInt<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        if self.is_zero() {
            return f.write_str("0n");
        }
        if *self.0.header() == Sign::Negative {
            f.write_char('-')?;
        }
        f.write_str("0x")?;
        let items = self.0.items();
        let last = items.length() - 1;
        write!(f, "{:X}", items[last])?;
        for i in (0..last).rev() {
            write!(f, "_{:016X}", items[i])?;
        }
        f.write_char('n')
    }
}

impl<A: IVm> Debug for Function<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
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

impl<A: IVm> Debug for Object<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        self.0.items_fmt('{', '}', f)
    }
}

const DOUBLE_QUOTE: u16 = '"' as u16;
const BACKSLASH: u16 = '\\' as u16;

impl<A: IVm> Debug for String16<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.write_char('"')?;
        for &i in self.0.items().to_iter() {
            match i {
                DOUBLE_QUOTE => f.write_str("\\\"")?,
                BACKSLASH => f.write_str("\\\\")?,
                c => {
                    if (0x20..=0x7F).contains(&c) {
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

impl<A: IVm> Debug for Unpacked<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Nullish(x) => x.fmt(f),
            Self::Boolean(x) => x.fmt(f),
            Self::Number(x) => x.fmt(f),
            Self::String(x) => x.fmt(f),
            Self::BigInt(x) => x.fmt(f),
            Self::Object(x) => x.fmt(f),
            Self::Array(x) => x.fmt(f),
            Self::Function(x) => x.fmt(f),
        }
    }
}
