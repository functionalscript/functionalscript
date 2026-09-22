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
//! The receiver a property step leaves behind is not held yet:
//! `Function::call` takes no receiver, so a call step composes the read and
//! the call. That composition lives here, behind the operation boundary,
//! so that when `IFunction::call` gains a receiver the change is this
//! module's alone (`fjs/edag/rust/todo/complex-operations.md`).

use crate::vm::{Any, IVm, Nullish, ToAny, Unpacked};

/// The state of a chain inside an open region: live with its current
/// value, skipped by a guard, or thrown. Skipped and thrown pass through
/// every step; `end` tells them apart.
pub(crate) enum Region<A: IVm> {
    Live(Any<A>),
    Skipped,
    Thrown(Any<A>),
}

impl<A: IVm> From<Result<Any<A>, Any<A>>> for Region<A> {
    fn from(r: Result<Any<A>, Any<A>>) -> Self {
        match r {
            Ok(v) => Region::Live(v),
            Err(e) => Region::Thrown(e),
        }
    }
}

impl<A: IVm> Region<A> {
    /// The region closed: a skipped chain is `undefined`, the value a
    /// short-circuit answers.
    fn end(self) -> Result<Any<A>, Any<A>> {
        match self {
            Region::Live(v) => Ok(v),
            Region::Skipped => Ok(Nullish::Undefined.to_any()),
            Region::Thrown(e) => Err(e),
        }
    }
    /// An unguarded step: `op` over a live value, nothing otherwise.
    fn step(self, op: impl FnOnce(Any<A>) -> Result<Any<A>, Any<A>>) -> Self {
        match self {
            Region::Live(v) => op(v).into(),
            other => other,
        }
    }
    /// A guarded step: a nullish live value skips the rest of the chain,
    /// its thunk untouched.
    pub(crate) fn guarded(self, op: impl FnOnce(Any<A>) -> Result<Any<A>, Any<A>>) -> Self {
        match self {
            Region::Live(v) if is_nullish(&v) => Region::Skipped,
            other => other.step(op),
        }
    }
}

/// Matches on `Unpacked` rather than `Nullish::try_from`, as
/// `nullish_coalescing` does, so the common non-nullish case allocates no
/// error value.
fn is_nullish<A: IVm>(v: &Any<A>) -> bool {
    matches!(Unpacked::from(v.clone()), Unpacked::Nullish(_))
}

/// The call step's operation: the arguments forced, then `Any::call`,
/// whose callability check therefore comes second.
pub(crate) fn call<A: IVm>(
    args: impl FnOnce() -> Result<Any<A>, Any<A>>,
) -> impl FnOnce(Any<A>) -> Result<Any<A>, Any<A>> {
    |callee| args().and_then(|a| callee.call(a))
}

/// The property step's operation: the key forced, then `Any::member_access`,
/// whose nullish-base throw therefore comes second.
pub(crate) fn read<A: IVm>(
    key: impl FnOnce() -> Result<Any<A>, Any<A>>,
) -> impl FnOnce(Any<A>) -> Result<Any<A>, Any<A>> {
    |base| key().and_then(|k| base.member_access(k))
}

/// A receiver is live and no region is open: the state after a `.` node,
/// `a.b`. Its steps are `|()` (`end_call`) and `|?.()` (`option_call`);
/// `end` is the bare node, the read with its receiver dropped.
///
/// No region, so no skipped state: the interior is the read's own
/// `Result`, its throw waiting for a terminal to surface it — `a.b(...c)`
/// on a nullish `a` throws at the access with `c` untouched, which is why
/// `end_call` takes its arguments as a thunk.
#[must_use]
pub struct PropertyLambda<A: IVm>(pub(crate) Result<Any<A>, Any<A>>);

impl<A: IVm> PropertyLambda<A> {
    /// No continuation: `a.b`.
    pub fn end(self) -> Result<Any<A>, Any<A>> {
        self.0
    }
    /// `|()`, terminal: `a.b(...args)`. No region is open, so this is also
    /// what a `|!()` would be — "there is no bit to clear".
    pub fn end_call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Result<Any<A>, Any<A>> {
        self.0.and_then(call(args))
    }
    /// `|?.()`: `a.b?.(...args)`, opening a region.
    pub fn option_call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionLambda<A> {
        OptionLambda(Region::from(self.0).guarded(call(args)))
    }
}

/// A region is open and no receiver is live: the state after a `?.()` node,
/// `a?.(...b)`, or a `|()` or `|?.()` step inside a region. Its steps are
/// `|()` (`call`) and `|.` (`dot`); no `|?.()`, and no `|!()` — there is no
/// receiver for either to justify.
#[must_use]
pub struct OptionLambda<A: IVm>(pub(crate) Region<A>);

impl<A: IVm> OptionLambda<A> {
    /// No continuation: the region closes, a skipped chain is `undefined`.
    pub fn end(self) -> Result<Any<A>, Any<A>> {
        self.0.end()
    }
    /// `|()`: call the current value, inside the region.
    pub fn call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionLambda<A> {
        OptionLambda(self.0.step(call(args)))
    }
    /// `|.`: read a property of the current value, inside the region; the
    /// value becomes the receiver.
    pub fn dot(self, key: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionPropertyLambda<A> {
        OptionPropertyLambda(self.0.step(read(key)))
    }
}

/// Both bits live: the state after a `?.` node, `a?.b`, or a `|.` step
/// inside a region. Every step is legal here: `|()` (`call`), `|.` (`dot`),
/// `|?.()` (`option_call`) and `|!()` (`end_call`).
#[must_use]
pub struct OptionPropertyLambda<A: IVm>(pub(crate) Region<A>);

impl<A: IVm> OptionPropertyLambda<A> {
    /// No continuation: `(a?.b)`, the region closed with nothing after it.
    pub fn end(self) -> Result<Any<A>, Any<A>> {
        self.0.end()
    }
    /// `|()`: `a?.b(...args)`, skipped with the region.
    pub fn call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionLambda<A> {
        OptionLambda(self.0.step(call(args)))
    }
    /// `|.`: `a?.b.c`, skipped with the region.
    pub fn dot(self, key: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionPropertyLambda<A> {
        OptionPropertyLambda(self.0.step(read(key)))
    }
    /// `|?.()`: `a?.b?.(...args)`, its own guard on the current value.
    pub fn option_call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionLambda<A> {
        OptionLambda(self.0.guarded(call(args)))
    }
    /// `|!()`, terminal: `(a?.b)(...args)`. The parentheses close the
    /// region first, so a skipped chain is `undefined` here and the call
    /// happens regardless — the arguments are evaluated, then `undefined`
    /// is called and throws. A thrown chain stays thrown, arguments
    /// untouched.
    pub fn end_call(self, args: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Result<Any<A>, Any<A>> {
        self.0.end().and_then(call(args))
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

    /// `a.b` — `end` is `member_access`, throw included.
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
