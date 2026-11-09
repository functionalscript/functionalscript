use crate::vm::{Any, IVm, ToAny, Unpacked};

/// The constructors `instanceof` may name: the EDAG's `constructorId`, a
/// closed list — `Array` alone today, where `Map` and `Set` are one variant
/// each once the VM has such values. A name, not a value: no global is a
/// value in the EDAG, so the operator's right side is carried as the word
/// it is, and a variant here rather than an `Any<A>`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Constructor {
    Array,
}

impl<A: IVm> Any<A> {
    /// `instanceof`, against a built-in constructor. Not a `core::ops`
    /// trait — Rust has no operator to spell it with — so this is a plain
    /// method, named as `typeof_` is: a trailing underscore keeps the
    /// reserved-word spelling recognizable. Never throws: the right side is
    /// a constructor by construction, so JavaScript's `TypeError` for a
    /// non-callable right operand has no case here; stays a `Result` to
    /// match every other operator's shape.
    /// <https://tc39.es/ecma262/#sec-instanceofoperator>
    pub fn instanceof_(&self, constructor: Constructor) -> Result<Any<A>, Any<A>> {
        Ok(match constructor {
            Constructor::Array => self.with_unpacked(|v| matches!(v, Unpacked::Array(_))),
        }
        .to_any())
    }
}
