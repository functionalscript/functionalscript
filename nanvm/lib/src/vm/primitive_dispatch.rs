use crate::vm::{
    Any, Array, BigInt, Function, IVm, Number, Object, String, ToAny, Unpacked, dispatch::Dispatch,
    nullish::Nullish, primitive_coercion::ToPrimitivePreferredType,
};

/// A coercion that converts a value through `ToPrimitive`: it says what each
/// primitive becomes and which type `ToPrimitive` prefers, and [`ViaPrimitive`]
/// makes it a [`Dispatch`] that routes an object, an array or a function
/// through `ToPrimitive(PREFERRED)` and back onto these methods.
///
/// <https://tc39.es/ecma262/#sec-tonumber> steps 8-10 and
/// <https://tc39.es/ecma262/#sec-tostring> steps 10-12 are that shared path:
/// `primValue = ? ToPrimitive(argument, PREFERRED)`, then the conversion of
/// `primValue`.
pub trait PrimitiveDispatch<A: IVm>: Sized {
    type Ok;
    const PREFERRED: ToPrimitivePreferredType;
    fn nullish(self, v: Nullish) -> Result<Self::Ok, Any<A>>;
    fn bool(self, v: bool) -> Result<Self::Ok, Any<A>>;
    fn number(self, v: Number) -> Result<Self::Ok, Any<A>>;
    fn string(self, v: String<A>) -> Result<Self::Ok, Any<A>>;
    fn bigint(self, v: BigInt<A>) -> Result<Self::Ok, Any<A>>;

    /// Through `ToPrimitive`, as an object is; a coercion that answers
    /// without the function's text overrides it.
    fn function(self, v: Function<A>) -> Result<Self::Ok, Any<A>> {
        via_primitive(self, v.to_any())
    }
}

/// `ToPrimitive(a, PREFERRED)`, never an object (the spec asserts as much),
/// then the conversion of that primitive.
fn via_primitive<A: IVm, P: PrimitiveDispatch<A>>(p: P, a: Any<A>) -> Result<P::Ok, Any<A>> {
    Unpacked::from(a.to_primitive(Some(P::PREFERRED))?).dispatch(ViaPrimitive(p))
}

/// The [`Dispatch`] of a [`PrimitiveDispatch`]. A wrapper rather than a
/// blanket `impl<P: PrimitiveDispatch<A>> Dispatch<A> for P`, which coherence
/// refuses next to the crate's other `Dispatch` impls: a downstream crate could
/// implement `PrimitiveDispatch<ItsVm>` for one of them.
pub struct ViaPrimitive<P>(pub P);

impl<A: IVm, P: PrimitiveDispatch<A>> Dispatch<A> for ViaPrimitive<P> {
    type Result = Result<P::Ok, Any<A>>;

    fn nullish(self, v: Nullish) -> Self::Result {
        self.0.nullish(v)
    }

    fn bool(self, v: bool) -> Self::Result {
        self.0.bool(v)
    }

    fn number(self, v: Number) -> Self::Result {
        self.0.number(v)
    }

    fn string(self, v: String<A>) -> Self::Result {
        self.0.string(v)
    }

    fn bigint(self, v: BigInt<A>) -> Self::Result {
        self.0.bigint(v)
    }

    fn object(self, v: Object<A>) -> Self::Result {
        via_primitive(self.0, v.to_any())
    }

    fn array(self, v: Array<A>) -> Self::Result {
        via_primitive(self.0, v.to_any())
    }

    fn function(self, v: Function<A>) -> Self::Result {
        self.0.function(v)
    }
}
