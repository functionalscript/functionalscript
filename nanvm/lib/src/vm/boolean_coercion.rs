use crate::{
    common::sized_index::SizedIndex,
    vm::{IVm, Unpacked},
};

/// Coerces the value to a `bool`. Unlike `NumberCoercion`/`StringCoercion`,
/// this never fails — `ToBoolean` inspects the operand's type directly and
/// never calls `ToPrimitive`, so there is nothing here that can throw.
/// <https://tc39.es/ecma262/#sec-toboolean>
///
/// This is equivalent to `!!x` in JavaScript.
impl<A: IVm> Unpacked<A> {
    pub(crate) fn to_boolean(&self) -> bool {
        match self {
            Self::Nullish(_) => false,
            Self::Boolean(v) => *v,
            Self::Number(v) => !v.is_nan() && *v != 0.into(),
            Self::String(v) => !v.is_empty(),
            Self::BigInt(v) => !v.is_zero(),
            Self::Object(_) | Self::Array(_) | Self::Function(_) => true,
        }
    }
}
