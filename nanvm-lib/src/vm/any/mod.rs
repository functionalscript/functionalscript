mod from;
mod neg;
mod partial_eq;

pub mod to_any;

use crate::vm::{
    dispatch::Dispatch,
    number_coercion::NumberCoercion,
    primitive::Primitive,
    primitive_coercion::{PrimitiveCoercionOp, ToPrimitivePreferredType},
    string_coercion::StringCoercion,
    IVm, String, ToAny,
};

/// ```
/// use nanvm_lib::{
///     vm::{Any, IVm, ToAny, String, Array, ToArray, ToObject, Object, BigInt, naive::Naive},
///     nullish::Nullish
/// };
/// fn any_test<A: IVm>() {
///     let b: Any<A> = true.to_any();
///     let n: Any<A> = Nullish::Null.to_any();
///     let n: Any<A> = 42.0.to_any();
///     let c: String<A> = "Hello".into();
///     let m: Any<A> = c.to_any();
///     let a: Array<A> = [].to_array();
///     let o: Any<A> = a.to_any();
///     let x: Object<A> = [].to_object();
///     let p: Any<A> = x.to_any();
///     let u: BigInt<A> = 123u64.into();
///     let q: Any<A> = u.to_any();
/// }
///
/// any_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct Any<A: IVm>(A);

impl<A: IVm> Any<A> {
    /// Unary plus is nothing but coercion to number.
    /// We use unary_plus as ECMAScript unary plus operator, and we use coerce_to_number for
    /// internals in places where ECMAScript's abstract function ToNumber is needed, and also when
    /// we need Result<f64, Any<A>> result type; here unary_plus returns Result<Any<A>, Any<A>> to
    /// match public API type of unary plus operator.
    /// <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unary_plus>
    /// <https://tc39.es/ecma262/#sec-unary-plus-operator>
    pub fn unary_plus(self) -> Result<Any<A>, Any<A>> {
        self.to_number().map(ToAny::to_any)
    }

    /// Same as `Number.isNaN` in ECMAScript.
    /// TODO: check and test.
    pub fn is_nan(self) -> bool {
        let Ok(n): Result<f64, _> = self.try_into() else {
            return false;
        };
        n.is_nan()
    }

    pub fn to_string(self) -> Result<String<A>, Any<A>> {
        self.dispatch(StringCoercion)
    }

    pub fn to_number(self) -> Result<f64, Any<A>> {
        self.dispatch(NumberCoercion)
    }

    pub fn to_primitive(
        self,
        preferred_type: Option<ToPrimitivePreferredType>,
    ) -> Result<Primitive<A>, Any<A>> {
        Ok(match preferred_type {
            Some(ToPrimitivePreferredType::Number) => Primitive::Number(self.to_number()?),
            Some(ToPrimitivePreferredType::String) => Primitive::String(self.to_string()?),
            None => self.dispatch(PrimitiveCoercionOp),
        })
    }

    fn dispatch<T: Dispatch<A>>(self, o: T) -> T::Result {
        self.0.to_unpacked().dispatch(o)
    }
}

// TODO implement other operators like +, -, *, /, %, &, |, ^, <<, >>, >>>, !, ~, etc using Rust
// standard traits - similarly to Neg above. Implement operators that do not have corresponding Rust
// standard traits via adding methods to Any<A> - similarly to unary_plus.
