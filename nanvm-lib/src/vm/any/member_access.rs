use super::CANNOT_CONVERT_NULLISH_TO_OBJECT;
use crate::vm::{Any, IVm, ToAny, Unpacked, nullish::Nullish};

impl<A: IVm> Any<A> {
    /// The EDAG's `.` / `[]` (`['.', receiver, index]`) — see
    /// `nanvm-lib/todo/member-access-operator.md` for the staged plan.
    /// An `Array` or `String` receiver is dispatched to
    /// `Array::member_access` / `String::member_access`
    /// (`vm/array/member_access.rs`, `vm/string/member_access.rs`), the
    /// same split `own_property` has between this dispatcher and
    /// `Object::own_property`. Every other receiver is Stage 3 (`Object`,
    /// and the `undefined` fallback for `Number`/`Boolean`/`BigInt`/
    /// `Function`) and is not implemented yet.
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
            _ => todo!(
                "member access on a Number/Boolean/BigInt/Object/Function receiver: see nanvm-lib/todo/member-access-operator.md"
            ),
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, ToAny, ToArray, ToObject},
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

    /// Stage 3 (`Object`, and everything else) of
    /// `nanvm-lib/todo/member-access-operator.md` is not implemented yet.
    #[test]
    #[should_panic]
    fn object_receiver_is_not_implemented_yet() {
        let object: Any<A> = [].to_object::<A>().to_any();
        let _ = object.member_access(0.0.to_any());
    }
}
