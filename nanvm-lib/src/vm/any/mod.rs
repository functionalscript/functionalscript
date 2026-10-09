mod add;
mod and;
mod bitand;
mod bitor;
mod bitxor;
mod call;
mod conditional;
mod div;
mod dot;
mod from;
mod get_iterator;
mod instanceof_;
mod mul;
mod neg;
mod not;
mod nullish_coalescing;
mod object_spread;
mod option_call;
mod or;
mod partial_eq;
mod relational;
mod rem;
mod shl;
mod shr;
mod sub;
mod to_json;
mod typeof_;

pub mod to_any;

pub use instanceof_::Constructor;
pub use to_json::JsonError;

use crate::vm::{
    IVm, Number, String, ToAny, Unpacked,
    boolean_coercion::BooleanCoercion,
    dispatch::Dispatch,
    nullish::Nullish,
    number_coercion::NumberCoercion,
    numeric::Numeric,
    primitive::Primitive,
    primitive_coercion::{PrimitiveCoercionOp, ToPrimitivePreferredType},
    string_coercion::StringCoercion,
};

/// `Object.getOwnPropertyDescriptor`'s own message for a nullish receiver
/// (`entry`'s throwing case of its own, the other being a key whose
/// conversion throws — see its doc comment).
pub(crate) const CANNOT_CONVERT_NULLISH_TO_OBJECT: &str =
    "TypeError: Cannot convert undefined or null to object";

/// ```
/// use nanvm_lib::{
///     vm::{Any, IVm, ToAny, String, Array, ToArray, ToObject, Object, Nullish, Number, BigInt},
///     naive::Naive
/// };
/// fn any_test<A: IVm>() {
///     let b: Any<A> = true.to_any();
///     let n: Any<A> = Nullish::Null.to_any();
///     let n: Any<A> = Number::from(42.0).to_any();
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
    /// we need Result<Number, Any<A>> result type; here unary_plus returns Result<Any<A>, Any<A>> to
    /// match public API type of unary plus operator.
    /// <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unary_plus>
    /// <https://tc39.es/ecma262/#sec-unary-plus-operator>
    pub fn unary_plus(self) -> Result<Any<A>, Any<A>> {
        self.to_number().map(ToAny::to_any)
    }

    /// `Number(value)`: `ToNumeric` of the value, a bigint converted to the
    /// nearest number and anything else as `unary_plus` has it. They differ in
    /// the bigint alone: `+1n` throws, `Number(1n)` is `1`.
    /// <https://tc39.es/ecma262/#sec-number-constructor-number-value>
    pub fn number(self) -> Result<Any<A>, Any<A>> {
        Ok(match self.to_numeric()? {
            Numeric::Number(n) => n,
            Numeric::BigInt(b) => b.to_number(),
        }
        .to_any())
    }

    /// `**`. Not a `core::ops` trait — Rust has no operator for
    /// exponentiation, so this is a plain method, the same as `unary_plus`.
    pub fn pow(self, rhs: Self) -> Result<Self, Self> {
        Ok(Unpacked::from(self.to_numeric()?.pow(rhs.to_numeric()?)?).into())
    }

    /// `~`. Not a `core::ops` trait — `Not` is already claimed by this
    /// type's own logical `!` (`any/not.rs`) — so this is a plain method,
    /// the same as `unary_plus`/`pow`.
    /// <https://tc39.es/ecma262/#sec-bitwise-not-operator>
    pub fn bitwise_not(self) -> Result<Self, Self> {
        Ok(Unpacked::from(self.to_numeric()?.bitwise_not()).into())
    }

    /// `>>>`. Not a `core::ops` trait — Rust has no unsigned-right-shift
    /// operator — so this is a plain method, the same as `pow`/`bitwise_not`.
    /// <https://tc39.es/ecma262/#sec-unsigned-right-shift-operator>
    pub fn unsigned_right_shift(self, rhs: Self) -> Result<Self, Self> {
        Ok(Unpacked::from(self.to_numeric()?.unsigned_right_shift(rhs.to_numeric()?)?).into())
    }

    /// The body of the language's `entry` helper, the function the EDAG's
    /// `['entry']` node is, called with `self` and `key`:
    ///
    /// ```js
    /// (a, b) => {
    ///     const x = Object.getOwnPropertyDescriptor(a, b);
    ///     return x?.enumerable ? x.value : undefined;
    /// }
    /// ```
    ///
    /// The enumerable own property `key` names: an `Object`'s field
    /// (`Object::own_property`), an `Array`'s element or a `String`'s code
    /// unit by its canonical index string (`Array::entry`, `String::entry`),
    /// and nothing a value owns without enumerating it — never a `length`,
    /// and nothing of a function. No getter invocation and no prototype
    /// chain (`nanvm-lib` objects have no `__proto__` to walk in the first
    /// place). Not a `core::ops` trait — no Rust operator fits a keyed
    /// property lookup — so this is a plain method, the same as
    /// `pow`/`bitwise_not`/`unsigned_right_shift`.
    ///
    /// The receiver is checked before the key is converted: real `ToObject`
    /// runs before `ToPropertyKey`
    /// (<https://tc39.es/ecma262/#sec-object.getownpropertydescriptor>), so
    /// a nullish receiver throws regardless of what the key is, and a key
    /// whose conversion throws does so under a receiver that is not. The
    /// key converts as `ToPropertyKey` converts it, which is `to_string`
    /// here, the language having no symbols: `0` and `"0"` name one entry,
    /// and an object converts through its own `toString`. A `Number`,
    /// `Boolean` or `BigInt` receiver owns no entry and answers
    /// `undefined`, as every absent key does.
    pub fn entry(self, key: Self) -> Result<Self, Self> {
        let unpacked: Unpacked<A> = self.into();
        if let Unpacked::Nullish(_) = &unpacked {
            return Err(CANNOT_CONVERT_NULLISH_TO_OBJECT.into());
        }
        let key = key.to_string()?;
        Ok(match unpacked {
            Unpacked::Object(o) => o.own_property(&key),
            Unpacked::Array(a) => a.entry(&key),
            Unpacked::String(s) => s.entry(&key),
            _ => None,
        }
        .unwrap_or_else(|| Nullish::Undefined.to_any()))
    }

    /// Same as `Number.isNaN` in ECMAScript.
    /// TODO: check and test.
    pub fn is_nan(self) -> bool {
        let Ok(n): Result<Number, _> = self.try_into() else {
            return false;
        };
        n.is_nan()
    }

    pub fn to_string(self) -> Result<String<A>, Any<A>> {
        self.dispatch(StringCoercion)
    }

    /// `ToString` where the algorithm discards the result: its throws still
    /// happen, and an object with its own `toString` is still refused, but a
    /// function's text, which cannot throw and is never read here, is not
    /// needed — so `[].join(f)` answers `""`, as it does in JavaScript
    /// (`nanvm-lib/todo/to-primitive.md`, Stage 1). An array converts
    /// through its elements alone, since it owns no `toString`, so a
    /// function inside one is skipped too: `[].join([f])` is `""`.
    pub fn to_string_unused(self) -> Result<(), Any<A>> {
        match self.clone().into() {
            Unpacked::Function(_) => Ok(()),
            Unpacked::Array(a) => a.into_iter().try_for_each(Self::to_string_unused),
            _ => self.to_string().map(|_| ()),
        }
    }

    pub fn to_number(self) -> Result<Number, Any<A>> {
        self.dispatch(NumberCoercion)
    }

    /// Never fails, unlike `to_number`/`to_string`/`to_numeric` — `ToBoolean`
    /// inspects the operand's type directly and never calls `ToPrimitive`.
    pub fn to_boolean(self) -> bool {
        self.dispatch(BooleanCoercion)
    }

    pub fn to_numeric(self) -> Result<Numeric<A>, Any<A>> {
        // https://tc39.es/ecma262/#sec-tonumeric
        // A function's primitive, its text, is a string and not a bigint, so
        // its `ToNumber` answers without converting it.
        if let Unpacked::Function(_) = self.clone().into() {
            return Ok(Numeric::Number(self.to_number()?));
        }
        let prim_value = self.to_primitive(Some(ToPrimitivePreferredType::Number))?;
        match prim_value {
            Primitive::BigInt(bi) => Ok(Numeric::BigInt(bi)),
            _ => {
                let u: Unpacked<A> = prim_value.into();
                let any: Any<A> = u.into();
                Ok(Numeric::Number(any.to_number()?))
            }
        }
    }

    pub fn to_primitive(
        self,
        preferred_type: Option<ToPrimitivePreferredType>,
    ) -> Result<Primitive<A>, Any<A>> {
        self.dispatch(PrimitiveCoercionOp(preferred_type))
    }

    fn dispatch<T: Dispatch<A>>(self, o: T) -> T::Result {
        self.0.to_unpacked().dispatch(o)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    fn undefined() -> Any<A> {
        Nullish::Undefined.to_any()
    }

    /// The receiver is checked before the key is converted (see `entry`'s
    /// own doc comment), so a nullish receiver throws the nullish
    /// `TypeError` whatever the key is — a `throws` expectation alone
    /// could not tell the two orders apart, so this compares the error.
    #[test]
    fn entry_nullish_receiver_outranks_the_key() {
        let key = (1f64).to_any::<A>();
        assert_eq!(
            Nullish::Null.to_any::<A>().entry(key.clone()),
            Err("TypeError: Cannot convert undefined or null to object".into())
        );
        assert_eq!(
            undefined().entry(key),
            Err("TypeError: Cannot convert undefined or null to object".into())
        );
    }

    /// The key converts as `ToPropertyKey` converts it: a number names the
    /// entry its decimal spelling names, `-0` the entry `"0"` does.
    #[test]
    fn entry_converts_the_key() {
        let o = [("1".into(), 42.0.to_any())].to_object().to_any::<A>();
        assert_eq!(o.clone().entry("1".into()), Ok(42.0.to_any()));
        assert_eq!(o.clone().entry(1.0.to_any()), Ok(42.0.to_any()));
        assert_eq!(o.entry("01".into()), Ok(undefined()));
        let z = [("0".into(), 7.0.to_any())].to_object().to_any::<A>();
        assert_eq!(z.entry((-0.0f64).to_any()), Ok(7.0.to_any()));
    }

    /// An array's and a string's elements are entries and their `length`
    /// is not; a function has none, and neither has any other primitive.
    #[test]
    fn entry_reads_elements_and_no_length() {
        let a = [7.0.to_any(), 8.0.to_any()].to_array().to_any::<A>();
        assert_eq!(a.clone().entry(1.0.to_any()), Ok(8.0.to_any()));
        assert_eq!(a.clone().entry("1".into()), Ok(8.0.to_any()));
        assert_eq!(a.clone().entry("2".into()), Ok(undefined()));
        assert_eq!(a.entry("length".into()), Ok(undefined()));
        let s: Any<A> = "ab".into();
        assert_eq!(s.clone().entry(1.0.to_any()), Ok("b".into()));
        assert_eq!(s.entry("length".into()), Ok(undefined()));
        assert_eq!(true.to_any::<A>().entry("0".into()), Ok(undefined()));
        assert_eq!(5.0.to_any::<A>().entry("0".into()), Ok(undefined()));
    }
}
