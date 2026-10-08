use crate::vm::{
    Any, Array, BigInt, Function, IVm, Number, Object, String, ToAny, dispatch::Dispatch,
    nullish::Nullish,
};

/// The constructors `instanceof` may name: the EDAG's `constructorId`, a
/// closed list — `Array` alone today, where `Map` and `Set` are one variant
/// each once the VM has such values. A name, not a value: no global is a
/// value in the EDAG, so the operator's right side is carried as the word
/// it is, and a variant here rather than an `Any<A>`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Constructor {
    Array,
}

/// `x instanceof Array`, over `Unpacked`: `true` of an array and `false` of
/// every other value, `null` and `undefined` included.
struct InstanceOfArray;

impl<A: IVm> Dispatch<A> for InstanceOfArray {
    type Result = bool;

    fn nullish(self, _: Nullish) -> Self::Result {
        false
    }

    fn bool(self, _: bool) -> Self::Result {
        false
    }

    fn number(self, _: Number) -> Self::Result {
        false
    }

    fn string(self, _: String<A>) -> Self::Result {
        false
    }

    fn bigint(self, _: BigInt<A>) -> Self::Result {
        false
    }

    fn object(self, _: Object<A>) -> Self::Result {
        false
    }

    fn array(self, _: Array<A>) -> Self::Result {
        true
    }

    fn function(self, _: Function<A>) -> Self::Result {
        false
    }
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
    pub fn instanceof_(self, constructor: Constructor) -> Result<Any<A>, Any<A>> {
        Ok(match constructor {
            Constructor::Array => self.dispatch(InstanceOfArray),
        }
        .to_any())
    }
}
