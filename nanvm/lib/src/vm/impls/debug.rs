use crate::common::sized_index::SizedIndex;
use crate::vm::{
    Any, Array, IVm, Unpacked, container_fmt::container_fmt, impls::unpack, numeric::Numeric,
    primitive::Primitive,
};
use core::fmt::{Debug, Formatter, Result};

impl<A: IVm> Debug for Any<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        self.with_unpacked(|v| v.fmt(f))
    }
}

impl<A: IVm> Debug for Array<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        container_fmt((0..self.length()).map(|i| &self[i]), '[', ']', f)
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

impl<A: IVm> Debug for Primitive<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        unpack(self).fmt(f)
    }
}

impl<A: IVm> Debug for Numeric<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        unpack(self).fmt(f)
    }
}
