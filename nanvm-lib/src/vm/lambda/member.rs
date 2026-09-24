use super::method::method;
use crate::vm::{Any, Array, IVm, Nullish, ToAny, Unpacked, any::CANNOT_CONVERT_NULLISH_TO_OBJECT};

/// A property step's live state: the receiver and the key, the read
/// deferred to the exit that needs it. `end` reads the property; a call
/// exit resolves the callee — an object's own property or an array's
/// element first, then the receiver type's built-in member function — and
/// the guard of `|?.()` asks the same resolution whether there is a callee
/// at all. Holding the key rather than the value is what lets a call reach
/// a built-in the receiver does not own, `[1].at(0)`, and what keeps the
/// receiver for it.
///
/// The receiver is never nullish: [`Member::new`] throws for one, before
/// the arguments of any step, and a live chain is one that got past it.
/// Deferring the read is unobservable after that — a read of a non-nullish
/// value throws for no key and nothing here mutates.
pub(crate) struct Member<A: IVm> {
    receiver: Any<A>,
    key: Any<A>,
}

impl<A: IVm> Member<A> {
    /// The `.` node's own step: a nullish receiver throws the `TypeError`
    /// `own_property` does — real JS's `[]` runs the same `ToObject`
    /// failure ahead of any key handling — and any other opens the step.
    pub(crate) fn new(receiver: Any<A>, key: Any<A>) -> Result<Self, Any<A>> {
        if let Unpacked::Nullish(_) = Unpacked::from(receiver.clone()) {
            return Err(CANNOT_CONVERT_NULLISH_TO_OBJECT.into());
        }
        Ok(Member { receiver, key })
    }

    /// The property the receiver owns under the key, or `None`. An
    /// `Array`, `String`, `Object` or `Function` receiver is dispatched to
    /// its own `member_access` (`vm/array/member_access.rs`,
    /// `vm/string/member_access.rs`, `vm/object/member_access.rs`,
    /// `vm/function/member_access.rs` — a function's one property is its
    /// `length`), the same split `own_property` has between its dispatcher
    /// and `Object::own_property`. Every remaining receiver — `Number`,
    /// `Boolean`, `BigInt` — owns nothing. No prototype chain: a built-in
    /// member function is reachable through a call alone, never as a
    /// value, which is the compiler's rule too
    /// (`fjs/js/prototype/README.md`).
    ///
    /// What the read answers, and what a call step finds before the
    /// built-ins: an own property shadows a built-in of the same name as it
    /// does in JavaScript — `{ toString: f }.toString()` calls `f`, and
    /// `[f][0](1)` calls the element — and an own property that is no
    /// function is called and thrown for, never passed over for a built-in:
    /// `"a"[0]()` and `f.length()` are the `TypeError` JavaScript throws,
    /// and `"a"[0]?.()` throws too, since the character is not nullish.
    fn own(&self) -> Option<Any<A>> {
        match Unpacked::from(self.receiver.clone()) {
            Unpacked::Array(a) => a.member_access(self.key.clone()),
            Unpacked::String(s) => s.member_access(self.key.clone()),
            Unpacked::Object(o) => o.member_access(self.key.clone()),
            Unpacked::Function(f) => f.member_access(self.key.clone()),
            _ => None,
        }
    }

    /// The property read, `a.b`: the own property, or `undefined` — the
    /// same fallback `own_property` has.
    pub(crate) fn read(self) -> Any<A> {
        self.own().unwrap_or_else(|| Nullish::Undefined.to_any())
    }

    /// The guard of `|?.()`: whether the callee the call would find is
    /// nullish — an own property that is, or nothing at all, no own
    /// property and no built-in of the name. `({}).at?.()` skips;
    /// `({}).toString?.()` calls.
    pub(crate) fn is_nullish(&self) -> bool {
        match self.own() {
            Some(v) => matches!(Unpacked::from(v), Unpacked::Nullish(_)),
            None => method(&self.receiver, &self.key).is_none(),
        }
    }

    /// The call, its arguments already evaluated: the own property or
    /// element if there is one — `Any::call` throwing for a value that is
    /// no function — else the receiver type's built-in of the name with the
    /// receiver, else the `TypeError` for calling `undefined`, as
    /// JavaScript throws on a type without the method. The arguments are
    /// the array a call spreads, and a value that is no array throws on
    /// every path, through `Array::try_from` as `Any::call` throws, before
    /// a built-in sees them.
    pub(crate) fn call(self, args: Any<A>) -> Result<Any<A>, Any<A>> {
        match self.own() {
            Some(callee) => callee.call(args),
            None => match method(&self.receiver, &self.key) {
                Some(f) => f(self.receiver, Array::try_from(args)?),
                None => Nullish::Undefined.to_any().call(args),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, IStaticFunction, Nullish, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    const TYPE_ERROR: &str = "Type Error";

    fn no_args() -> Result<Any<A>, Any<A>> {
        Ok([].to_array().to_any())
    }
    /// A function answering `7`, whatever it is called with.
    fn seven() -> Any<A> {
        A::static_function(|_, _| Ok(7.0.to_any()), 0, [].to_array()).to_any()
    }

    /// An own property shadows the built-in of the same name, and an own
    /// property that is no function is the `TypeError` for calling it,
    /// never the built-in behind it.
    #[test]
    fn own_property_first() {
        let shadowed: Any<A> = [("toString".into(), seven())].to_object().to_any();
        assert_eq!(
            shadowed.dot("toString".into()).end_call(no_args),
            Ok(7.0.to_any())
        );
        let not_callable: Any<A> = [("toString".into(), 1.0.to_any())].to_object().to_any();
        assert_eq!(
            not_callable.dot("toString".into()).end_call(no_args),
            Err(TYPE_ERROR.into())
        );
    }

    /// `[f][0](...)` calls the element; `[1][0](...)` throws for it.
    #[test]
    fn array_element_first() {
        let fs: Any<A> = [seven()].to_array().to_any();
        assert_eq!(fs.dot(0.0.to_any()).end_call(no_args), Ok(7.0.to_any()));
        let ns: Any<A> = [1.0.to_any()].to_array().to_any();
        assert_eq!(
            ns.dot(0.0.to_any()).end_call(no_args),
            Err(TYPE_ERROR.into())
        );
    }

    /// A name with no own property and no built-in is the `TypeError` for
    /// calling `undefined`; an own property that is no function — a
    /// string's character, a function's `length` — is the `TypeError` for
    /// calling it. JavaScript throws for all four.
    #[test]
    fn no_method_throws() {
        let object: Any<A> = [].to_object().to_any();
        assert_eq!(
            object.dot("at".into()).end_call(no_args),
            Err(TYPE_ERROR.into())
        );
        let s: Any<A> = "ab".into();
        assert_eq!(
            s.dot(0.0.to_any()).end_call(no_args),
            Err(TYPE_ERROR.into())
        );
        assert_eq!(
            seven().dot("length".into()).end_call(no_args),
            Err(TYPE_ERROR.into())
        );
        assert_eq!(
            1.0.to_any::<A>().dot("at".into()).end_call(no_args),
            Err(TYPE_ERROR.into())
        );
    }

    /// The guard of `?.()` asks the same resolution: nothing to call skips,
    /// a built-in does not, an own nullish property skips, and an own
    /// property that is not nullish is called — and thrown for where it is
    /// no function, as JavaScript does for `"a"[0]?.()` and `f.length?.()`.
    #[test]
    fn option_call_guard_sees_built_ins() {
        let object: Any<A> = [("u".into(), Nullish::Null.to_any())].to_object().to_any();
        assert_eq!(
            object.clone().dot("at".into()).option_call(no_args).end(),
            Ok(Nullish::Undefined.to_any())
        );
        let s: Any<A> = "a".into();
        assert_eq!(
            s.dot(0.0.to_any()).option_call(no_args).end(),
            Err(TYPE_ERROR.into())
        );
        assert_eq!(
            seven().dot("length".into()).option_call(no_args).end(),
            Err(TYPE_ERROR.into())
        );
        assert_eq!(
            object.clone().dot("u".into()).option_call(no_args).end(),
            Ok(Nullish::Undefined.to_any())
        );
        assert_eq!(
            object.dot("toString".into()).option_call(no_args).end(),
            Ok("[object Object]".into())
        );
    }

    /// The arguments of a built-in are the array a call spreads: a value
    /// that is no array throws before the built-in runs, as `Any::call`
    /// throws for it.
    #[test]
    fn built_in_arguments_must_be_an_array() {
        assert_eq!(
            1.0.to_any::<A>()
                .dot("toString".into())
                .end_call(|| Ok(Nullish::Null.to_any())),
            Err(TYPE_ERROR.into())
        );
    }

    /// The read is deferred to the exit, unobservably: `end` still answers
    /// the property, a nullish receiver still throws at `dot`, before any
    /// arguments.
    #[test]
    fn deferred_read() {
        let object: Any<A> = [("a".into(), 1.0.to_any())].to_object().to_any();
        assert_eq!(object.dot("a".into()).end(), Ok(1.0.to_any()));
        assert_eq!(
            Nullish::Undefined
                .to_any::<A>()
                .dot("toString".into())
                .end_call(|| Err("boom".into())),
            Err("TypeError: Cannot convert undefined or null to object".into())
        );
    }
}
