use crate::vm::{container_fmt::ContainerFmt, Any, Array, IVm, Object, String, Unpacked};
use core::{
    fmt::{Debug, Formatter, Result, Write},
    ops::RangeInclusive,
};

impl<A: IVm> Debug for Any<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        let u: Unpacked<_> = self.clone().into();
        u.fmt(f)
    }
}

impl<A: IVm> Debug for Array<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        self.container_fmt('[', ']', f)
    }
}

impl<A: IVm> Debug for Object<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        self.container_fmt('{', '}', f)
    }
}

impl<A: IVm> Debug for String<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        const DOUBLE_QUOTE: u16 = '"' as u16;
        const BACKSLASH: u16 = '\\' as u16;
        const PRINTABLE_ASCII: RangeInclusive<u16> = 0x20..=0x7F;
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

impl<A: IVm> Debug for Unpacked<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
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
