use super::CANNOT_CONVERT_NULLISH_TO_OBJECT;
use crate::vm::{
    Any, IVm, ToAny, Unpacked,
    lambda::{OptionPropertyLambda, PropertyLambda, Region, read},
    nullish::Nullish,
};

impl<A: IVm> Any<A> {
    /// The EDAG's `.` node, `['.', receiver, key]` or with a continuation,
    /// `['.', receiver, key, k]`: the property read, as a chain a
    /// continuation may follow (`fjs/edag/README.md`, Chains).
    /// `dot(a, key).end()` is `a.b`, the one spelling of the node whether
    /// or not a continuation follows, and the one property read `nanvm-lib`
    /// has. The key is a value: `a[k]` evaluates both operands whatever
    /// they are.
    ///
    /// An `Array`, `String`, `Object` or `Function` receiver is dispatched
    /// to its own `member_access` (`vm/array/member_access.rs`,
    /// `vm/string/member_access.rs`, `vm/object/member_access.rs`,
    /// `vm/function/member_access.rs` — a function's one property is its
    /// `length`), the same split `own_property` has between its dispatcher
    /// and `Object::own_property`. Every remaining receiver — `Number`,
    /// `Boolean`, `BigInt` — has no own properties, so it always answers
    /// `undefined`, the same fallback `own_property` has. No prototype
    /// chain and no built-in methods (`.map`, `.push`, `.slice`, getters)
    /// on any receiver — out of scope, since `nanvm-lib` objects have no
    /// `__proto__` to walk in the first place (see `own_property`'s own doc
    /// comment).
    ///
    /// A nullish receiver throws the same `TypeError` `own_property` does:
    /// real JS's `[]` runs the same `ToObject` failure ahead of any key
    /// handling that `Object.getOwnPropertyDescriptor` does. The throw
    /// waits in the lambda until `end` or `end_call` surfaces it, so
    /// `a.b(...c)` on a nullish `a` throws with `c` untouched.
    pub fn dot(self, key: Self) -> PropertyLambda<A> {
        let unpacked: Unpacked<A> = self.into();
        if let Unpacked::Nullish(_) = &unpacked {
            return PropertyLambda(Err(CANNOT_CONVERT_NULLISH_TO_OBJECT.into()));
        }
        PropertyLambda(Ok(match unpacked {
            Unpacked::Array(a) => a
                .member_access(key)
                .unwrap_or_else(|| Nullish::Undefined.to_any()),
            Unpacked::String(s) => s
                .member_access(key)
                .unwrap_or_else(|| Nullish::Undefined.to_any()),
            Unpacked::Object(o) => o
                .member_access(key)
                .unwrap_or_else(|| Nullish::Undefined.to_any()),
            Unpacked::Function(f) => f
                .member_access(key)
                .unwrap_or_else(|| Nullish::Undefined.to_any()),
            _ => Nullish::Undefined.to_any(),
        }))
    }

    /// The EDAG's `?.` node, `['?.', receiver, key, k]`: `a?.b`, opening a
    /// short-circuit region. A nullish receiver skips the key and the rest
    /// of the chain — `u?.[todo()]` never calls `todo` — which is why the
    /// key is a thunk. Any other receiver is read as `dot` reads it.
    pub fn option_dot(self, key: impl FnOnce() -> Result<Self, Self>) -> OptionPropertyLambda<A> {
        OptionPropertyLambda(Region::Live(self).guarded(read(key)))
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, IStaticFunction, Nullish, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    const NULLISH_BASE: &str = "TypeError: Cannot convert undefined or null to object";

    fn undefined() -> Any<A> {
        Nullish::Undefined.to_any()
    }

    #[test]
    fn nullish_receiver_throws() {
        assert_eq!(
            undefined().dot(0.0.to_any()).end(),
            Err(NULLISH_BASE.into())
        );
        assert_eq!(
            Nullish::Null.to_any::<A>().dot("a".into()).end(),
            Err(NULLISH_BASE.into())
        );
    }

    /// The dispatch wiring itself, as opposed to `Array::member_access`'s
    /// own behavior, which is tested in `vm/array/member_access.rs`.
    #[test]
    fn array_receiver_dispatches_to_array_member_access() {
        let array: Any<A> = [10.0.to_any(), 20.0.to_any()].to_array().to_any();
        assert_eq!(array.clone().dot(1.0.to_any()).end(), Ok(20.0.to_any()));
        assert_eq!(array.dot(2.0.to_any()).end(), Ok(undefined()));
    }

    /// The dispatch wiring itself, as opposed to `String::member_access`'s
    /// own behavior, which is tested in `vm/string/member_access.rs`.
    #[test]
    fn string_receiver_dispatches_to_string_member_access() {
        let s: Any<A> = "ab".into();
        assert_eq!(s.clone().dot(1.0.to_any()).end(), Ok("b".into()));
        assert_eq!(s.dot(2.0.to_any()).end(), Ok(undefined()));
    }

    /// The dispatch wiring itself, as opposed to `Object::member_access`'s
    /// own behavior, which is tested in `vm/object/member_access.rs`.
    #[test]
    fn object_receiver_dispatches_to_object_member_access() {
        let object: Any<A> = [("a".into(), 1.0.to_any())].to_object().to_any();
        assert_eq!(object.clone().dot("a".into()).end(), Ok(1.0.to_any()));
        assert_eq!(object.dot("b".into()).end(), Ok(undefined()));
    }

    /// The dispatch wiring itself, as opposed to `Function::member_access`'s
    /// own behavior, which is tested in `vm/function/member_access.rs`.
    #[test]
    fn function_receiver_dispatches_to_function_member_access() {
        let f: Any<A> = A::static_function(|_, _| Ok(undefined()), 0, [].to_array()).to_any();
        assert_eq!(f.clone().dot("length".into()).end(), Ok(0.0.to_any()));
        assert_eq!(f.dot("a".into()).end(), Ok(undefined()));
    }

    /// `Number`, `Boolean` and `BigInt` receivers have no own properties at
    /// all, so every key on one reads `undefined` — the same fallback
    /// `own_property` has.
    #[test]
    fn primitive_receiver_has_no_properties() {
        assert_eq!(1.0.to_any::<A>().dot(0.0.to_any()).end(), Ok(undefined()));
        assert_eq!(
            true.to_any::<A>().dot("length".into()).end(),
            Ok(undefined())
        );
    }

    /// The node's own key is inside the region it opens: skipped on a
    /// nullish receiver, evaluated on any other.
    #[test]
    fn option_dot_guards_the_key() {
        let object: Any<A> = [("a".into(), 1.0.to_any())].to_object().to_any();
        assert_eq!(
            undefined().option_dot(|| Err("boom".into())).end(),
            Ok(undefined())
        );
        assert_eq!(
            object.clone().option_dot(|| Ok("a".into())).end(),
            Ok(1.0.to_any())
        );
        assert_eq!(
            object.option_dot(|| Err("boom".into())).end(),
            Err("boom".into())
        );
    }
}
