//! The three continuation types of `fjs/edag/README.md`'s Chains section,
//! one per combination of its two bits — a receiver is live (P), a
//! short-circuit region is open (O) — that is not a node boundary. A
//! chain is opened by a node's entry point on [`Any`] (`dot`, `option_dot`,
//! `option_call` in `vm/any`), continued by one method per step the README
//! allows in that state, and closed by `end` or `end_call`, which alone
//! answer the chain's `Result`. A step the README does not allow is a
//! method that does not exist, so a spelling that disagrees with the
//! README does not compile.
//!
//! None of the three is `Clone`, and every method consumes `self`: a
//! continuation "cannot be lifted out as a shared node", so a chain is used
//! once, and `#[must_use]` makes a chain used zero times a warning. What a
//! terminal answers is an ordinary `Result<Any<A>, Any<A>>`, shareable as
//! any value is — neither bit is ever the result of an `exp`.
//!
//! A step's order is *guard, thunk, operation*: a guarded step looks at the
//! current value for nullishness first and skips its thunk on it; every
//! other question about the value — that a callee is callable, that a base
//! is not nullish — is asked after the thunk is forced, as JavaScript
//! evaluates a call's arguments before `IsCallable` and a computed key
//! before the read.
//!
//! A property step holds its receiver and key, [`Member`], and the read
//! waits for the exit: `end` reads, and a call exit resolves the callee —
//! an object's own property or an array's element first, then the
//! receiver type's built-in member function ([`method`](method::method)),
//! then the `TypeError` for calling `undefined`. No user function reads
//! `this`, so `Function::call` takes no receiver and never will: the
//! receiver is consumed by the built-in and handed to nothing. Which
//! built-ins the table answers is `nanvm-lib/todo/member-functions.md`.

use crate::vm::{Any, IVm, Nullish, ToAny, Unpacked};

pub(crate) mod member;
mod method;

/// The completeness table `method`'s test checks it against, generated from
/// `fjs/js/prototype`'s call lists by `fjs/nanvm/methods` — a `#[path]`,
/// since a `gen.` name is not a Rust identifier.
#[cfg(test)]
#[path = "gen.methods.rs"]
mod methods_table;

pub(crate) use member::Member;

/// What a chain's live state can do, whatever it holds: a bare value, the
/// state after a call step or a `?.()` node, or a [`Member`], the receiver
/// and key of a property step whose read waits for the exit.
pub(crate) trait Live<A: IVm>: Sized {
    /// The chain's current value: the value itself, or the property read.
    fn value(self) -> Any<A>;
    /// The guard of a `?.()` step: whether what the call would call is nullish.
    fn is_nullish(&self) -> bool;
    /// The call, its arguments evaluated: `Any::call` of a value, and a
    /// member's own-property-first resolution.
    fn call(self, args: Any<A>) -> Result<Any<A>, Any<A>>;
}

impl<A: IVm> Live<A> for Any<A> {
    fn value(self) -> Any<A> {
        self
    }
    /// Matches on `Unpacked` rather than `Nullish::try_from`, as
    /// `nullish_coalescing` does, so the common non-nullish case allocates
    /// no error value.
    fn is_nullish(&self) -> bool {
        matches!(Unpacked::from(self.clone()), Unpacked::Nullish(_))
    }
    fn call(self, args: Any<A>) -> Result<Any<A>, Any<A>> {
        Any::call(self, args)
    }
}

impl<A: IVm> Live<A> for Member<A> {
    fn value(self) -> Any<A> {
        self.read()
    }
    fn is_nullish(&self) -> bool {
        Member::is_nullish(self)
    }
    fn call(self, args: Any<A>) -> Result<Any<A>, Any<A>> {
        Member::call(self, args)
    }
}

/// The state of a chain inside an open region: live, skipped by a guard, or
/// thrown. Skipped and thrown pass through every step; `end` tells them
/// apart.
pub(crate) enum Region<A: IVm, T: Live<A>> {
    Live(T),
    Skipped,
    Thrown(Any<A>),
}

impl<A: IVm, T: Live<A>> From<Result<T, Any<A>>> for Region<A, T> {
    fn from(r: Result<T, Any<A>>) -> Self {
        match r {
            Ok(v) => Region::Live(v),
            Err(e) => Region::Thrown(e),
        }
    }
}

impl<A: IVm, T: Live<A>> Region<A, T> {
    /// The region closed: a skipped chain is `undefined`, the value a
    /// short-circuit answers.
    fn end(self) -> Result<Any<A>, Any<A>> {
        match self {
            Region::Live(v) => Ok(v.value()),
            Region::Skipped => Ok(Nullish::Undefined.to_any()),
            Region::Thrown(e) => Err(e),
        }
    }
    /// An unguarded step: `op` over a live state, nothing otherwise.
    fn step<U: Live<A>>(self, op: impl FnOnce(T) -> Result<U, Any<A>>) -> Region<A, U> {
        match self {
            Region::Live(v) => op(v).into(),
            Region::Skipped => Region::Skipped,
            Region::Thrown(e) => Region::Thrown(e),
        }
    }
    /// `|()`: the arguments forced, then the call, whose callability check
    /// therefore comes second.
    fn call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Region<A, Any<A>> {
        self.step(|v| args().and_then(|a| v.call(a)))
    }
    /// `|.`: the key forced, then the step over the current value as the
    /// receiver, whose nullish throw therefore comes second.
    pub(crate) fn dot(self, key: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Region<A, Member<A>> {
        self.step(|v| key().and_then(|k| Member::new(v.value(), k)))
    }
    /// The `?.` node's own step: a nullish receiver skips the key and the
    /// rest of the chain; any other takes the step `|.` takes.
    pub(crate) fn option_dot(
        self,
        key: impl FnOnce() -> Result<Any<A>, Any<A>>,
    ) -> Region<A, Member<A>> {
        match self {
            Region::Live(v) if v.is_nullish() => Region::Skipped,
            other => other.dot(key),
        }
    }
    /// `|?.()`: a nullish callee skips the rest of the chain, its
    /// arguments untouched; any other is called.
    pub(crate) fn option_call(
        self,
        args: impl FnOnce() -> Result<Any<A>, Any<A>>,
    ) -> Region<A, Any<A>> {
        match self {
            Region::Live(v) if v.is_nullish() => Region::Skipped,
            other => other.call(args),
        }
    }
}

/// A receiver is live and no region is open: the state after a `.` node,
/// `a.b`. Its steps are `|()` (`end_call`) and `|?.()` (`option_call`);
/// `end` is the bare node, the read with its receiver dropped — the one
/// property read `nanvm-lib` has, `dot(a, key).end()`.
///
/// No region, so no skipped state: the interior is the step's own
/// `Result`, its nullish-receiver throw waiting for a terminal to surface
/// it — `a.b(...c)` on a nullish `a` throws at the access with `c`
/// untouched, which is why `end_call` takes its arguments as a thunk.
#[must_use]
pub struct PropertyLambda<A: IVm>(pub(crate) Result<Member<A>, Any<A>>);

impl<A: IVm> PropertyLambda<A> {
    /// No continuation: `a.b`.
    pub fn end(self) -> Result<Any<A>, Any<A>> {
        self.0.map(Member::read)
    }
    /// `|()`, terminal: `a.b(...args)`, the property called on its
    /// receiver — an own property, or a built-in member function. No
    /// region is open, so this is also what a `|!()` would be — "there is
    /// no bit to clear".
    pub fn end_call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Result<Any<A>, Any<A>> {
        self.0.and_then(|m| args().and_then(|a| m.call(a)))
    }
    /// `|?.()`: `a.b?.(...args)`, opening a region.
    pub fn option_call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionLambda<A> {
        OptionLambda(Region::from(self.0).option_call(args))
    }
}

/// A region is open and no receiver is live: the state after a `?.()` node,
/// `a?.(...b)`, or a `|()` or `|?.()` step inside a region. Its steps are
/// `|()` (`call`) and `|.` (`dot`); no `|?.()`, and no `|!()` — there is no
/// receiver for either to justify.
#[must_use]
pub struct OptionLambda<A: IVm>(pub(crate) Region<A, Any<A>>);

impl<A: IVm> OptionLambda<A> {
    /// No continuation: the region closes, a skipped chain is `undefined`.
    pub fn end(self) -> Result<Any<A>, Any<A>> {
        self.0.end()
    }
    /// `|()`: call the current value, inside the region.
    pub fn call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionLambda<A> {
        OptionLambda(self.0.call(args))
    }
    /// `|.`: a property of the current value, inside the region; the value
    /// becomes the receiver.
    pub fn dot(self, key: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionPropertyLambda<A> {
        OptionPropertyLambda(self.0.dot(key))
    }
}

/// Both bits live: the state after a `?.` node, `a?.b`, or a `|.` step
/// inside a region. Every step is legal here: `|()` (`call`), `|.` (`dot`),
/// `|?.()` (`option_call`) and `|!()` (`end_call`).
#[must_use]
pub struct OptionPropertyLambda<A: IVm>(pub(crate) Region<A, Member<A>>);

impl<A: IVm> OptionPropertyLambda<A> {
    /// No continuation: `(a?.b)`, the region closed with nothing after it.
    pub fn end(self) -> Result<Any<A>, Any<A>> {
        self.0.end()
    }
    /// `|()`: `a?.b(...args)`, the property called on its receiver, skipped
    /// with the region.
    pub fn call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionLambda<A> {
        OptionLambda(self.0.call(args))
    }
    /// `|.`: `a?.b.c`, skipped with the region.
    pub fn dot(self, key: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionPropertyLambda<A> {
        OptionPropertyLambda(self.0.dot(key))
    }
    /// `|?.()`: `a?.b?.(...args)`, its own guard on the callee.
    pub fn option_call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionLambda<A> {
        OptionLambda(self.0.option_call(args))
    }
    /// `|!()`, terminal: `(a?.b)(...args)`. The parentheses close the
    /// region first, so a skipped chain is `undefined` here and the call
    /// happens regardless — the arguments are evaluated, then `undefined`
    /// is called and throws. A live chain calls the property on its
    /// receiver; a thrown chain stays thrown, arguments untouched.
    pub fn end_call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Result<Any<A>, Any<A>> {
        match self.0 {
            Region::Live(m) => args().and_then(|a| m.call(a)),
            Region::Skipped => args().and_then(|a| Nullish::Undefined.to_any().call(a)),
            Region::Thrown(e) => Err(e),
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
    type Thunk = Box<dyn FnOnce() -> Result<Any<A>, Any<A>>>;

    const TYPE_ERROR: &str = "Type Error";
    const NULLISH_BASE: &str = "TypeError: Cannot convert undefined or null to object";

    /// A thunk that must not be forced.
    fn boom() -> Result<Any<A>, Any<A>> {
        Err("boom".into())
    }
    fn undefined() -> Any<A> {
        Nullish::Undefined.to_any()
    }
    /// A function that answers its arguments, as the array it was given.
    fn identity() -> Any<A> {
        A::static_function(|_, args| Ok(args.to_any()), 0, [].to_array()).to_any()
    }
    /// A fresh arguments array, for a chain whose answer is not the array.
    fn args() -> Result<Any<A>, Any<A>> {
        Ok([7.0.to_any()].to_array().to_any())
    }
    /// Asserts that `chain`, handed a thunk over a fresh arguments array,
    /// answers that very array: a call of `identity` reached its callee.
    /// Arrays compare by identity, so the array is made once and cloned.
    fn answers_arguments(chain: impl FnOnce(Thunk) -> Result<Any<A>, Any<A>>) {
        let a = args().unwrap();
        let thunk = a.clone();
        assert_eq!(chain(Box::new(|| Ok(thunk))), Ok(a));
    }
    /// `{ f: identity, n: 1, u: undefined }`
    fn object() -> Any<A> {
        [
            ("f".into(), identity()),
            ("n".into(), 1.0.to_any()),
            ("u".into(), undefined()),
        ]
        .to_object()
        .to_any()
    }
    fn key(k: &str) -> impl FnOnce() -> Result<Any<A>, Any<A>> {
        let k: Any<A> = k.into();
        || Ok(k)
    }

    // `PropertyLambda`

    /// `a.b` — `end` is the read, throw included.
    #[test]
    fn property_end() {
        assert_eq!(object().dot("n".into()).end(), Ok(1.0.to_any()));
        assert_eq!(undefined().dot("n".into()).end(), Err(NULLISH_BASE.into()));
    }

    /// `a.f(...c)`, and `a.b(...c)` on a nullish `a`: the throw waited in
    /// the lambda and `c` was never evaluated.
    #[test]
    fn property_end_call() {
        answers_arguments(|args| object().dot("f".into()).end_call(args));
        assert_eq!(
            undefined().dot("f".into()).end_call(boom),
            Err(NULLISH_BASE.into())
        );
    }

    /// A live, non-callable callee: the arguments run before the
    /// callability check, so theirs is the throw.
    #[test]
    fn property_end_call_forces_arguments_before_callability() {
        assert_eq!(object().dot("n".into()).end_call(boom), Err("boom".into()));
        assert_eq!(
            object().dot("n".into()).end_call(args),
            Err(TYPE_ERROR.into())
        );
    }

    /// `a.b?.(...c)`: guarded on the property, then a region.
    #[test]
    fn property_option_call() {
        answers_arguments(|args| object().dot("f".into()).option_call(args).end());
        assert_eq!(
            object().dot("u".into()).option_call(boom).end(),
            Ok(undefined())
        );
        assert_eq!(
            object().dot("n".into()).option_call(boom).end(),
            Err("boom".into())
        );
        assert_eq!(
            undefined().dot("f".into()).option_call(boom).end(),
            Err(NULLISH_BASE.into())
        );
    }

    // `OptionLambda`

    /// `a?.(...c).length` and `a?.().f(...d)`: steps inside the region on
    /// a live value.
    #[test]
    fn option_steps_live() {
        assert_eq!(
            identity().option_call(args).dot(key("length")).end(),
            Ok(1.0.to_any())
        );
        let returns_object: Any<A> =
            A::static_function(|_, _| Ok(object()), 0, [].to_array()).to_any();
        answers_arguments(|args| {
            returns_object
                .option_call(|| Ok([].to_array().to_any()))
                .dot(key("f"))
                .call(args)
                .end()
        });
    }

    /// A skipped region passes through every step, thunks untouched, and
    /// ends as `undefined`.
    #[test]
    fn option_steps_skipped() {
        assert_eq!(
            undefined()
                .option_call(boom)
                .dot(boom)
                .call(boom)
                .dot(boom)
                .end(),
            Ok(undefined())
        );
    }

    /// A thrown region passes through every step, thunks untouched, and
    /// ends with its throw.
    #[test]
    fn option_steps_thrown() {
        assert_eq!(
            identity().option_call(boom).dot(key("x")).call(args).end(),
            Err("boom".into())
        );
    }

    // `OptionPropertyLambda`

    /// `a?.f(...c)`, `a?.n.x`, `a?.u?.(...c)`, `a?.f?.(...c)`: the three
    /// non-terminal steps on a live chain.
    #[test]
    fn option_property_steps_live() {
        answers_arguments(|args| object().option_dot(key("f")).call(args).end());
        assert_eq!(
            object().option_dot(key("n")).dot(key("x")).end(),
            Ok(undefined())
        );
        assert_eq!(
            object().option_dot(key("u")).option_call(boom).end(),
            Ok(undefined())
        );
        answers_arguments(|args| object().option_dot(key("f")).option_call(args).end());
    }

    /// `a?.b.c(...d).e?.(...f)` on a nullish `a`: one region, everything
    /// skipped.
    #[test]
    fn option_property_steps_skipped() {
        assert_eq!(
            undefined()
                .option_dot(boom)
                .dot(boom)
                .call(boom)
                .dot(boom)
                .option_call(boom)
                .end(),
            Ok(undefined())
        );
    }

    /// `|()` and `|.` are unguarded: on a live but nullish current value
    /// the thunk is forced and the operation throws — `a?.b()` with `a.b`
    /// undefined throws, it does not answer `undefined`. One case per
    /// unguarded step, so that turning any of them into a guarded step
    /// fails a test.
    #[test]
    fn unguarded_steps_throw_on_nullish_current_value() {
        let returns_undefined: Any<A> =
            A::static_function(|_, _| Ok(undefined()), 0, [].to_array()).to_any();
        assert_eq!(
            returns_undefined.clone().option_call(args).call(boom).end(),
            Err("boom".into())
        );
        assert_eq!(
            returns_undefined.option_call(args).dot(boom).end(),
            Err("boom".into())
        );
        assert_eq!(
            object().option_dot(key("u")).call(boom).end(),
            Err("boom".into())
        );
    }

    /// `|.` on a live but nullish current value throws at the read — after
    /// the key is forced, as JavaScript evaluates `u[k()]`.
    #[test]
    fn option_property_dot_forces_key_before_read() {
        assert_eq!(
            object().option_dot(key("u")).dot(boom).end(),
            Err("boom".into())
        );
        assert_eq!(
            object().option_dot(key("u")).dot(key("x")).end(),
            Err(NULLISH_BASE.into())
        );
    }

    /// `(a?.f)(...c)` live, and `(a?.b)(...c)` on a nullish `a`: the
    /// parentheses end the region, so the arguments run and `undefined` is
    /// called — the case the host engines disagree on, and the
    /// specification's reading.
    #[test]
    fn option_property_end_call() {
        answers_arguments(|args| object().option_dot(key("f")).end_call(args));
        assert_eq!(
            undefined().option_dot(boom).end_call(boom),
            Err("boom".into())
        );
        assert_eq!(
            undefined().option_dot(boom).end_call(args),
            Err(TYPE_ERROR.into())
        );
    }

    /// A thrown chain stays thrown through `end_call`, arguments untouched.
    #[test]
    fn option_property_end_call_thrown() {
        assert_eq!(object().option_dot(boom).end_call(boom), Err("boom".into()));
    }
}
