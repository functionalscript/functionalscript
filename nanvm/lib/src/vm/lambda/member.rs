use super::method::method;
use crate::vm::{
    Any, Array, Function, IVm, ToArray, Unpacked,
    member_access::{non_nullish_receiver, undefined_if_absent},
};

/// A property step's live state: the receiver and the key, the read
/// deferred to the exit that needs it. `end` reads the property; a call
/// exit resolves the callee — an object's own property or an array's
/// element first, then the body the runtime value's `dot` answers for the
/// name, then the receiver type's native member function for a name
/// without a body — and the guard of `|?.()` asks the same resolution
/// whether there is a callee at all. Holding the key rather than the
/// value is what lets a call reach a built-in the receiver does not own,
/// `[1].at(0)`, and what keeps the receiver for it.
///
/// The receiver is never nullish: [`Member::new`] throws for one, before
/// the arguments of any step, and a live chain is one that got past it.
/// A call resolves the member before arguments, then resolves it again at
/// invocation. Resolution is pure; its failure must precede argument control.
pub(crate) struct Member<A: IVm> {
    receiver: Any<A>,
    key: Any<A>,
}

impl<A: IVm> Member<A> {
    /// Native entries admit their own names. Runtime-only methods come
    /// from the shared interpreter inventory, paired with their receiver
    /// type's prototype by the existing methods generator.
    fn admits(&self) -> bool {
        if method(&self.receiver, &self.key).is_some() {
            return true;
        }
        let type_name = match Unpacked::from(self.receiver.clone()) {
            Unpacked::Array(_) => "Array",
            Unpacked::String(_) => "String",
            Unpacked::Number(_) => "Number",
            Unpacked::Boolean(_) => "Boolean",
            Unpacked::BigInt(_) => "BigInt",
            Unpacked::Function(_) => "Function",
            _ => "Object",
        };
        super::methods_table::RUNTIME_ONLY
            .iter()
            .any(|(type_, name)| *type_ == type_name && self.key.is_str(name))
    }

    /// The `.` node's own step: a nullish receiver throws
    /// (`member_access::non_nullish_receiver`) — real JS's `[]` runs the
    /// same `ToObject` failure ahead of any key handling — and any other
    /// opens the step.
    pub(crate) fn new(receiver: Any<A>, key: Any<A>) -> Result<Self, Any<A>> {
        non_nullish_receiver(receiver.clone())?;
        Ok(Member { receiver, key })
    }

    /// The property the receiver owns under the key, or `None`. An
    /// `Array`, `String`, `Object` or `Function` receiver is dispatched to
    /// its own `member_access` (`vm/array/member_access.rs`,
    /// `vm/string/member_access.rs`, `vm/object/member_access.rs`,
    /// `vm/function/member_access.rs` — a function's one property is its
    /// `length`), the same split `Any::entry` has between its dispatcher
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

    /// The property read, `a.b`: the own property, or `undefined`
    /// (`member_access::undefined_if_absent`).
    pub(crate) fn read(self) -> Any<A> {
        undefined_if_absent(self.own())
    }

    /// The function the runtime value's `dot` answers for the receiver and
    /// the key, or `None`: the body of the name, a function of the receiver
    /// answering the function of the arguments, `undefined` for a receiver
    /// the name is no member of, or the throw of its first step
    /// (`fjs/js/runtime`'s `dot`; `fjs/js/runtime/README.md`, "How NaNVM
    /// finds it"). `dot` is pure, so the guard of `?.()` and the call may
    /// each ask it. Asked before the native table, as the interpreter asks
    /// it, so a name with a body is the body's wherever it is called and a
    /// native beside a body is unreachable: substituting a native for a
    /// body, which DESIGN.md §13 allows a VM, is a measured change to this
    /// order, not an entry in the table.
    fn body(&self, runtime: &Any<A>) -> Result<Option<Any<A>>, Any<A>> {
        // Runtime overrides do not add names to a receiver's prototype.
        if !self.admits() {
            return Ok(None);
        }
        let Unpacked::Object(object) = Unpacked::from(runtime.clone()) else {
            return Ok(None);
        };
        let Some(dot) = object.member_access("dot".into()) else {
            return Ok(None);
        };
        let Ok(dot) = Function::try_from(dot) else {
            return Ok(None);
        };
        let callee = dot.call([self.receiver.clone(), self.key.clone()].to_array())?;
        Ok(callee.defined())
    }

    /// The guard of `|?.()`: whether the callee the call would find is
    /// nullish — an own property that is, or nothing at all, no own
    /// property and no built-in of the name, native or the runtime's, which
    /// the runtime's body decides for the receiver, and may throw deciding.
    /// `({}).at?.()` skips; `({}).toString?.()` calls.
    pub(crate) fn is_nullish(&self, runtime: &Any<A>) -> Result<bool, Any<A>> {
        match self.own() {
            Some(v) => Ok(v.is_nullish()),
            None => {
                Ok(self.body(runtime)?.is_none() && method(&self.receiver, &self.key).is_none())
            }
        }
    }

    /// The call, its arguments already evaluated: the own property or
    /// element if there is one — `Any::call` throwing for a value that is
    /// no function — else the function the runtime value's body answers
    /// for the receiver, called with the arguments, else the receiver
    /// type's native built-in of the name with the receiver, for a name
    /// without a body, else the `TypeError` for calling `undefined`, as
    /// JavaScript throws on a type without the method. The arguments are
    /// the array a call spreads, and a value that is no array throws on
    /// every path, through `Array::try_from` as `Any::call` throws,
    /// before a built-in sees them.
    pub(crate) fn call(self, runtime: &Any<A>, args: Any<A>) -> Result<Any<A>, Any<A>> {
        match self.own() {
            Some(callee) => callee.call(args),
            None => match self.body(runtime)? {
                Some(f) => f.call(args),
                None => match method(&self.receiver, &self.key) {
                    Some(f) => f(self.receiver, Array::try_from(args)?),
                    None => Any::undefined().call(args),
                },
            },
        }
    }

    /// The call that asks no runtime: the own property or element, else the
    /// native built-in, else the `TypeError` — what an intrinsic's helper
    /// answers, `slice(s, a, b)`, a member function no body defines, so
    /// the runtime has nothing to add and need not be in scope
    /// (`fjs/js/intrinsic`).
    pub(crate) fn call_native(self, args: Any<A>) -> Result<Any<A>, Any<A>> {
        match self.own() {
            Some(callee) => callee.call(args),
            None => match method(&self.receiver, &self.key) {
                Some(f) => f(self.receiver, Array::try_from(args)?),
                None => Any::undefined().call(args),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::test::function::{no_args, returns, rt, throws};
    use crate::{
        naive::Naive,
        vm::{Any, IVm, Nullish, ToAny, ToArray, ToObject, error},
    };

    type A = Naive;

    /// A function answering `7`, whatever it is called with.
    fn seven() -> Any<A> {
        returns(7.0.to_any())
    }

    /// A lookup provider that returns a captured value without calling it.
    fn answering(value: Any<A>) -> Any<A> {
        [(
            "dot".into(),
            A::static_function(
                |self_, _| Ok(A::frame(self_)[0].clone()),
                2,
                [value].to_array(),
                None,
            )
            .to_any(),
        )]
        .to_object()
        .to_any()
    }

    fn throwing() -> Any<A> {
        [(
            "dot".into(),
            A::static_function(|_, _| Err("lookup".into()), 2, [].to_array(), None).to_any(),
        )]
        .to_object()
        .to_any()
    }

    /// The public query performs the complete guard: stored nullish values
    /// shadow native names, and nonnullish values are present before any
    /// callable check. Native methods need not exist as readable properties.
    #[test]
    fn member_presence() {
        let one: Any<A> = [1.0.to_any()].to_array().to_any();
        for runtime in [Any::undefined(), [].to_object().to_any(), rt()] {
            assert_eq!(
                one.clone().member_present("at".into(), &runtime),
                Ok(true.to_any())
            );
            assert_eq!(
                one.clone().member_present(0.0.to_any(), &runtime),
                Ok(true.to_any())
            );
            assert_eq!(
                one.clone().member_present("length".into(), &runtime),
                Ok(true.to_any())
            );
            assert_eq!(
                one.clone().member_present("missing".into(), &runtime),
                Ok(false.to_any())
            );
        }
        for value in [
            Any::undefined(),
            Nullish::Null.to_any(),
            0.0.to_any(),
            false.to_any(),
            "".into(),
            seven(),
        ] {
            let expected = !value.is_nullish();
            let object = [("toString".into(), value)].to_object().to_any();
            assert_eq!(
                object.member_present("toString".into(), &throwing()),
                Ok(expected.to_any())
            );
        }
        assert_eq!(
            seven().member_present("length".into(), &throwing()),
            Ok(true.to_any())
        );
        assert_eq!(
            Any::undefined().member_present("a".into(), &rt()),
            Err(error::nullish_to_object())
        );
        assert_eq!(
            Nullish::Null
                .to_any::<A>()
                .member_present("a".into(), &rt()),
            Err(error::nullish_to_object())
        );
    }

    /// Runtime presence is an undefined-only check, unlike own-property
    /// nullishness. No argument-stage callable is invoked by the query.
    #[test]
    fn runtime_presence_and_admission() {
        let one: Any<A> = [1.0.to_any()].to_array().to_any();
        let failing = throws("callee".into());
        for value in [
            Nullish::Null.to_any(),
            0.0.to_any(),
            false.to_any(),
            "".into(),
            [].to_object().to_any(),
            failing,
        ] {
            let runtime = answering(value);
            assert_eq!(
                one.clone().member_present("at".into(), &runtime),
                Ok(true.to_any())
            );
        }
        let noncallable = [("dot".into(), Nullish::Null.to_any())]
            .to_object()
            .to_any();
        assert_eq!(
            one.clone().member_present("at".into(), &noncallable),
            Ok(true.to_any())
        );
        assert_eq!(
            one.clone()
                .member_present("at".into(), &answering(Any::undefined())),
            Ok(true.to_any())
        );
        assert_eq!(
            one.clone().member_present("at".into(), &throwing()),
            Err("lookup".into())
        );
        // The provider cannot invent an unadmitted name or add a native
        // method to a type whose prototype has no such member.
        assert_eq!(
            one.member_present("unknown".into(), &throwing()),
            Ok(false.to_any())
        );
        let object = [].to_object().to_any::<A>();
        assert_eq!(
            object.member_present("at".into(), &answering(seven())),
            Ok(false.to_any())
        );
        for (_, name) in super::super::methods_table::RUNTIME_ONLY {
            let text: Any<A> = "abc".into();
            assert_eq!(
                text.clone()
                    .member_present((*name).into(), &Any::undefined()),
                Ok(false.to_any())
            );
            assert_eq!(
                text.clone().member_present((*name).into(), &rt()),
                Ok(true.to_any())
            );
            assert_eq!(
                text.clone()
                    .member_present((*name).into(), &answering(Nullish::Null.to_any())),
                Ok(true.to_any())
            );
            assert_eq!(
                text.clone().member_present((*name).into(), &throwing()),
                Err("lookup".into())
            );
            assert_eq!(
                text.clone()
                    .dot((*name).into())
                    .option_call(&Any::undefined(), || panic!(
                        "missing runtime skips arguments"
                    ))
                    .end(),
                Ok(Any::undefined())
            );
            assert_eq!(
                text.dot((*name).into())
                    .end_call(&answering(seven()), no_args),
                Ok(7.0.to_any())
            );
            assert_eq!(
                1.0.to_any::<A>()
                    .member_present((*name).into(), &throwing()),
                Ok(false.to_any())
            );
        }
    }

    /// The host thunk API schedules member resolution before arguments.
    /// A panic sentinel pins whether that thunk is forced; it does not
    /// choose between two FunctionalScript failure diagnostics.
    #[test]
    fn ordinary_lookup_precedes_arguments() {
        let one: Any<A> = [1.0.to_any()].to_array().to_any();
        assert_eq!(
            one.clone()
                .dot("at".into())
                .end_call(&throwing(), || panic!("lookup must fail first")),
            Err("lookup".into())
        );
        assert_eq!(
            one.clone()
                .option_dot(|| Ok("at".into()))
                .call(&throwing(), || panic!("lookup must fail first"))
                .end(),
            Err("lookup".into())
        );
        assert_eq!(
            one.option_dot(|| Ok("at".into()))
                .end_call(&throwing(), || panic!("lookup must fail first")),
            Err("lookup".into())
        );
    }

    /// An own property shadows the built-in of the same name, and an own
    /// property that is no function is the `TypeError` for calling it,
    /// never the built-in behind it.
    #[test]
    fn own_property_first() {
        let shadowed: Any<A> = [("toString".into(), seven())].to_object().to_any();
        assert_eq!(
            shadowed.dot("toString".into()).end_call(&rt(), no_args),
            Ok(7.0.to_any())
        );
        let not_callable: Any<A> = [("toString".into(), 1.0.to_any())].to_object().to_any();
        assert_eq!(
            not_callable.dot("toString".into()).end_call(&rt(), no_args),
            Err(error::unexpected_type())
        );
    }

    /// The runtime value's `dot` is asked before the native table: a body
    /// for a name the table answers too is what the call reaches, and the
    /// table answers only where `dot` says `undefined` — `at`, which has
    /// no body in the runtime, is the native's through it.
    #[test]
    fn body_before_native() {
        let answering: Any<A> = [(
            "dot".into(),
            A::static_function(
                |self_, _| Ok(A::frame(self_)[0].clone()),
                2,
                [seven()].to_array(),
                None,
            )
            .to_any(),
        )]
        .to_object()
        .to_any();
        let one: Any<A> = [1.0.to_any()].to_array().to_any();
        let zero = || Ok([0.0.to_any()].to_array().to_any());
        assert_eq!(
            one.clone().dot("at".into()).end_call(&answering, zero),
            Ok(7.0.to_any())
        );
        assert_eq!(one.dot("at".into()).end_call(&rt(), zero), Ok(1.0.to_any()));
    }

    /// The guard of `?.()` asks `dot` before the native table too, and
    /// before any argument: for `[1].at?.(x)` on a runtime whose `dot`
    /// throws, the answer is that throw and `x` is never evaluated, where
    /// the native table alone would call `at` with `x`. The call asks in
    /// the same order.
    #[test]
    fn guard_asks_body_first() {
        let throwing: Any<A> = [(
            "dot".into(),
            A::static_function(|_, _| Err("boom".into()), 2, [].to_array(), None).to_any(),
        )]
        .to_object()
        .to_any();
        let one: Any<A> = [1.0.to_any()].to_array().to_any();
        assert_eq!(
            one.clone()
                .dot("at".into())
                .option_call(&throwing, || panic!("the argument is not evaluated"))
                .end(),
            Err("boom".into())
        );
        let zero = || Ok([0.0.to_any()].to_array().to_any());
        assert_eq!(
            one.clone().dot("at".into()).option_call(&rt(), zero).end(),
            Ok(1.0.to_any())
        );
        assert_eq!(
            one.dot("at".into()).end_call(&throwing, zero),
            Err("boom".into())
        );
    }

    /// `[f][0](...)` calls the element; `[1][0](...)` throws for it.
    #[test]
    fn array_element_first() {
        let fs: Any<A> = [seven()].to_array().to_any();
        assert_eq!(
            fs.dot(0.0.to_any()).end_call(&rt(), no_args),
            Ok(7.0.to_any())
        );
        let ns: Any<A> = [1.0.to_any()].to_array().to_any();
        assert_eq!(
            ns.dot(0.0.to_any()).end_call(&rt(), no_args),
            Err(error::unexpected_type())
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
            object.dot("at".into()).end_call(&rt(), no_args),
            Err(error::unexpected_type())
        );
        let s: Any<A> = "ab".into();
        assert_eq!(
            s.dot(0.0.to_any()).end_call(&rt(), no_args),
            Err(error::unexpected_type())
        );
        assert_eq!(
            seven().dot("length".into()).end_call(&rt(), no_args),
            Err(error::unexpected_type())
        );
        assert_eq!(
            1.0.to_any::<A>().dot("at".into()).end_call(&rt(), no_args),
            Err(error::unexpected_type())
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
            object
                .clone()
                .dot("at".into())
                .option_call(&rt(), no_args)
                .end(),
            Ok(Any::undefined())
        );
        let s: Any<A> = "a".into();
        assert_eq!(
            s.dot(0.0.to_any()).option_call(&rt(), no_args).end(),
            Err(error::unexpected_type())
        );
        assert_eq!(
            seven()
                .dot("length".into())
                .option_call(&rt(), no_args)
                .end(),
            Err(error::unexpected_type())
        );
        assert_eq!(
            object
                .clone()
                .dot("u".into())
                .option_call(&rt(), no_args)
                .end(),
            Ok(Any::undefined())
        );
        assert_eq!(
            object
                .dot("toString".into())
                .option_call(&rt(), no_args)
                .end(),
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
                .end_call(&rt(), || Ok(Nullish::Null.to_any())),
            Err(error::unexpected_type())
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
            Any::<A>::undefined()
                .dot("toString".into())
                .end_call(&rt(), || Err("boom".into())),
            Err(error::nullish_to_object())
        );
    }
}
