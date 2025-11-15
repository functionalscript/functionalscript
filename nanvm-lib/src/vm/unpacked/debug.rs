use crate::vm::{IVm, Unpacked};
use core::fmt::{Debug, Formatter, Result};

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
