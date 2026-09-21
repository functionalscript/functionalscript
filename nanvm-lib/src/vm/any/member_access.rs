use super::CANNOT_CONVERT_NULLISH_TO_OBJECT;
use crate::vm::{Any, IVm, ToAny, Unpacked, nullish::Nullish};

impl<A: IVm> Any<A> {
    /// The EDAG's `.` / `[]` (`['.', receiver, index]`). An `Array`,
    /// `String`, `Object` or `Function` receiver is dispatched to its own
    /// `member_access` (`vm/array/member_access.rs`,
    /// `vm/string/member_access.rs`, `vm/object/member_access.rs`,
    /// `vm/function/member_access.rs` — a function's one property is its
    /// `length`), the same split `own_property` has between this
    /// dispatcher and `Object::own_property`. Every remaining receiver —
    /// `Number`, `Boolean`, `BigInt` — has no own properties, so it always
    /// answers `undefined`, the same fallback `own_property` has.
    /// No prototype chain and no built-in methods (`.map`, `.push`,
    /// `.slice`, getters) on any receiver — out of scope, since
    /// `nanvm-lib` objects have no `__proto__` to walk in the first place
    /// (see `own_property`'s own doc comment); nor the EDAG's chain-step
    /// nodes (`|.`, `?.`, etc. — `fjs/edag/README.md`'s Chains section),
    /// which carry hidden control flow this plain read doesn't.
    ///
    /// A nullish receiver throws the same `TypeError` `own_property` does:
    /// real JS's `[]` runs the same `ToObject` failure ahead of any key
    /// handling that `Object.getOwnPropertyDescriptor` does.
    pub fn member_access(self, key: Self) -> Result<Self, Self> {
        let unpacked: Unpacked<A> = self.into();
        if let Unpacked::Nullish(_) = &unpacked {
            return Err(CANNOT_CONVERT_NULLISH_TO_OBJECT.into());
        }
        Ok(match unpacked {
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
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, IStaticFunction, Nullish, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    #[test]
    fn nullish_receiver_throws() {
        let receiver = Nullish::Undefined.to_any::<A>();
        assert_eq!(
            receiver.member_access(0.0.to_any()),
            Err("TypeError: Cannot convert undefined or null to object".into())
        );
    }

    /// The dispatch wiring itself, as opposed to `Array::member_access`'s
    /// own behavior, which is tested in `vm/array/member_access.rs`.
    #[test]
    fn array_receiver_dispatches_to_array_member_access() {
        let array: Any<A> = [10.0.to_any(), 20.0.to_any()].to_array().to_any();
        assert_eq!(array.clone().member_access(1.0.to_any()), Ok(20.0.to_any()));
        assert_eq!(
            array.member_access(2.0.to_any()),
            Ok(Nullish::Undefined.to_any())
        );
    }

    /// The dispatch wiring itself, as opposed to `String::member_access`'s
    /// own behavior, which is tested in `vm/string/member_access.rs`.
    #[test]
    fn string_receiver_dispatches_to_string_member_access() {
        let s: Any<A> = "ab".into();
        assert_eq!(s.clone().member_access(1.0.to_any()), Ok("b".into()));
        assert_eq!(
            s.member_access(2.0.to_any()),
            Ok(Nullish::Undefined.to_any())
        );
    }

    /// The dispatch wiring itself, as opposed to `Object::member_access`'s
    /// own behavior, which is tested in `vm/object/member_access.rs`.
    #[test]
    fn object_receiver_dispatches_to_object_member_access() {
        let object: Any<A> = [("a".into(), 1.0.to_any())].to_object().to_any();
        assert_eq!(object.clone().member_access("a".into()), Ok(1.0.to_any()));
        assert_eq!(
            object.member_access("b".into()),
            Ok(Nullish::Undefined.to_any())
        );
    }

    /// The dispatch wiring itself, as opposed to `Function::member_access`'s
    /// own behavior, which is tested in `vm/function/member_access.rs`.
    #[test]
    fn function_receiver_dispatches_to_function_member_access() {
        let f: Any<A> =
            A::static_function(|_, _| Ok(Nullish::Undefined.to_any()), 0, [].to_array()).to_any();
        assert_eq!(f.clone().member_access("length".into()), Ok(0.0.to_any()));
        assert_eq!(f.member_access("a".into()), Ok(Nullish::Undefined.to_any()));
    }

    /// `Number`, `Boolean` and `BigInt` receivers have no own properties at
    /// all, so every key on one reads `undefined` — the same fallback
    /// `own_property` has.
    #[test]
    fn primitive_receiver_has_no_properties() {
        assert_eq!(
            1.0.to_any::<A>().member_access(0.0.to_any()),
            Ok(Nullish::Undefined.to_any())
        );
        assert_eq!(
            true.to_any::<A>().member_access("length".into()),
            Ok(Nullish::Undefined.to_any())
        );
    }
}
