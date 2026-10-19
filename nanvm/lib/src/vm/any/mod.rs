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
    IVm, Number, String, ToAny, ToArray, Unpacked,
    boolean_coercion::BooleanCoercion,
    dispatch::Dispatch,
    member_access::non_nullish_receiver,
    nullish::Nullish,
    number_coercion::NumberCoercion,
    numeric::Numeric,
    numeric_coercion,
    primitive::Primitive,
    primitive_coercion::{PrimitiveCoercionOp, ToPrimitivePreferredType},
    primitive_dispatch::ViaPrimitive,
    string_coercion::StringCoercion,
};

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
    /// `undefined`.
    pub fn undefined() -> Self {
        Nullish::Undefined.to_any()
    }

    /// Whether `self` is `undefined` or `null`: `Unpacked::is_nullish` over
    /// one unpack of a clone. A caller that already holds the `Unpacked` asks
    /// it instead and keeps its single conversion.
    pub fn is_nullish(&self) -> bool {
        Unpacked::from(self.clone()).is_nullish()
    }

    /// `None` for `undefined`, `Some(self)` for every other value, `null`
    /// included: the argument an optional parameter was passed, if it was
    /// passed one. `Unpacked::is_undefined` over one unpack of a clone.
    pub fn defined(self) -> Option<Self> {
        (!Unpacked::from(self.clone()).is_undefined()).then_some(self)
    }

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
        self.numeric_op(rhs, Numeric::pow)
    }

    /// `~`. Not a `core::ops` trait — `Not` is already claimed by this
    /// type's own logical `!` (`any/not.rs`) — so this is a plain method,
    /// the same as `unary_plus`/`pow`.
    /// <https://tc39.es/ecma262/#sec-bitwise-not-operator>
    pub fn bitwise_not(self) -> Result<Self, Self> {
        Ok(Unpacked::from(self.to_numeric()?.bitwise_not()?).into())
    }

    /// `>>>`. Not a `core::ops` trait — Rust has no unsigned-right-shift
    /// operator — so this is a plain method, the same as `pow`/`bitwise_not`.
    /// <https://tc39.es/ecma262/#sec-unsigned-right-shift-operator>
    pub fn unsigned_right_shift(self, rhs: Self) -> Result<Self, Self> {
        self.numeric_op(rhs, Numeric::unsigned_right_shift)
    }

    /// The shape every numeric binary operator shares: `ToNumeric` of the
    /// left operand, then of the right, then `op` on the two (`+` once it
    /// has ruled out a string concatenation).
    /// <https://tc39.es/ecma262/#sec-applystringornumericbinaryoperator>
    fn numeric_op(
        self,
        rhs: Self,
        op: impl FnOnce(Numeric<A>, Numeric<A>) -> Result<Numeric<A>, Self>,
    ) -> Result<Self, Self> {
        Ok(Unpacked::from(op(self.to_numeric()?, rhs.to_numeric()?)?).into())
    }

    /// The body of the language's `entry` helper, the function the EDAG's
    /// `['entry']` node is, called with `self` and `key`:
    ///
    /// ```js
    /// (a, b) => {
    ///     const x = Object.getOwnPropertyDescriptor(a, b);
    ///     return x?.enumerable ? [x.value] : [];
    /// }
    /// ```
    ///
    /// The option of the enumerable own property `key` names: a fresh
    /// one-element `Array` holding an `Object`'s field
    /// (`Object::own_property`), an `Array`'s element or a `String`'s code
    /// unit by its canonical index string (`Array::entry`, `String::entry`),
    /// an entry holding `undefined` included, and an empty `Array` for
    /// nothing a value owns without enumerating it — never a `length`,
    /// and nothing of a function. No getter invocation and no prototype
    /// chain (`nanvm-lib` objects have no `__proto__` to walk in the first
    /// place). Not a `core::ops` trait — no Rust operator fits a keyed
    /// property lookup — so this is a plain method, the same as
    /// `pow`/`bitwise_not`/`unsigned_right_shift`.
    ///
    /// The receiver is checked before the key is converted
    /// (`member_access::non_nullish_receiver`), so a nullish receiver
    /// throws regardless of what the key is, and a key whose conversion
    /// throws does so under a receiver that is not. The key converts as
    /// `ToPropertyKey` converts it, which is `to_string` here, the language
    /// having no symbols: `0` and `"0"` name one entry, and an object
    /// converts through its own `toString`. A `Number`,
    /// `Boolean` or `BigInt` receiver owns no entry and answers the empty
    /// option, as every absent key does. An `Option<Any>` is the one- or
    /// zero-element sequence the array is built from.
    pub fn entry(self, key: Self) -> Result<Self, Self> {
        Ok(self.own_entry(key)?.to_array().to_any())
    }

    /// The `hasEntry` helper: whether the enumerable own property `key`
    /// names is there, the one bit [`Any::entry`]'s option carries, `true`
    /// for an entry holding `undefined`, the receiver and the key treated
    /// as `entry` treats them, so a nullish receiver throws and a key
    /// converts first (`spec/todo/2345-has-entry.md`).
    pub fn has_entry(self, key: Self) -> Result<bool, Self> {
        Ok(self.own_entry(key)?.is_some())
    }

    /// The enumerable own property `key` names, or `None`: what `entry` and
    /// `has_entry` share, the receiver checked before the key is converted.
    fn own_entry(self, key: Self) -> Result<Option<Self>, Self> {
        let unpacked = non_nullish_receiver(self)?;
        let key = key.to_string()?;
        Ok(match unpacked {
            Unpacked::Object(o) => o.own_property(&key),
            Unpacked::Array(a) => a.entry(&key),
            Unpacked::String(s) => s.entry(&key),
            _ => None,
        })
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
        self.dispatch(ViaPrimitive(StringCoercion))
    }

    /// `ToString` where the algorithm discards the result: its throws still
    /// happen, and an object with its own `toString` is still refused, but a
    /// function's text, which cannot throw and is never read here, is not
    /// needed — so `[].join(f)` answers `""`, as it does in JavaScript
    /// (`nanvm/lib/todo/to-primitive.md`, Stage 1). An array converts
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
        self.dispatch(ViaPrimitive(NumberCoercion))
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
        numeric_coercion::to_numeric(self.to_primitive(Some(ToPrimitivePreferredType::Number))?)
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
        common::sized_index::SizedIndex,
        naive::Naive,
        vm::{Any, Nullish, ToAny, ToArray, ToObject, Unpacked, error},
    };

    type A = Naive;

    /// What an `entry` answer holds: the one element of a one-element
    /// array, or nothing of an empty one.
    fn option(answer: Result<Any<A>, Any<A>>) -> Option<Any<A>> {
        let Unpacked::Array(a) = Unpacked::from(answer.unwrap()) else {
            panic!("not an array")
        };
        match a.length() {
            0 => None,
            1 => Some(a[0].clone()),
            _ => panic!("not an option"),
        }
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
            Err(error::nullish_to_object())
        );
        assert_eq!(Any::undefined().entry(key), Err(error::nullish_to_object()));
    }

    /// The key converts as `ToPropertyKey` converts it: a number names the
    /// entry its decimal spelling names, `-0` the entry `"0"` does.
    #[test]
    fn entry_converts_the_key() {
        let o = [("1".into(), 42.0.to_any())].to_object().to_any::<A>();
        assert_eq!(option(o.clone().entry("1".into())), Some(42.0.to_any()));
        assert_eq!(option(o.clone().entry(1.0.to_any())), Some(42.0.to_any()));
        assert_eq!(option(o.entry("01".into())), None);
        let z = [("0".into(), 7.0.to_any())].to_object().to_any::<A>();
        assert_eq!(option(z.entry((-0.0f64).to_any())), Some(7.0.to_any()));
    }

    /// `has_entry` is the option's presence: `true` for an entry holding
    /// `undefined`, `false` for none, a `length` or anything of a function,
    /// with `entry`'s throws for a nullish receiver and a key whose
    /// conversion throws.
    #[test]
    fn has_entry_is_the_presence() {
        let o = [("u".into(), Any::undefined()), ("1".into(), 42.0.to_any())]
            .to_object()
            .to_any::<A>();
        assert_eq!(o.clone().has_entry("u".into()), Ok(true));
        assert_eq!(o.clone().has_entry("v".into()), Ok(false));
        assert_eq!(o.clone().has_entry(1.0.to_any()), Ok(true));
        assert_eq!(o.has_entry("toString".into()), Ok(false));
        let a = [7.0.to_any()].to_array().to_any::<A>();
        assert_eq!(a.clone().has_entry("0".into()), Ok(true));
        assert_eq!(a.has_entry("length".into()), Ok(false));
        let s: Any<A> = "ab".into();
        assert_eq!(s.clone().has_entry(1.0.to_any()), Ok(true));
        assert_eq!(s.has_entry("length".into()), Ok(false));
        assert_eq!(5.0.to_any::<A>().has_entry("0".into()), Ok(false));
        assert_eq!(
            Nullish::Null.to_any::<A>().has_entry("x".into()),
            Err(error::nullish_to_object())
        );
    }

    /// An entry holding `undefined` is an entry, which the option tells
    /// from none; and the option is a fresh array every call.
    #[test]
    fn entry_holds_undefined() {
        let o = [("u".into(), Any::undefined())].to_object().to_any::<A>();
        assert_eq!(option(o.clone().entry("u".into())), Some(Any::undefined()));
        assert_eq!(option(o.clone().entry("v".into())), None);
        assert_ne!(o.clone().entry("u".into()), o.entry("u".into()));
    }

    /// An array's and a string's elements are entries and their `length`
    /// is not; a function has none, and neither has any other primitive.
    #[test]
    fn entry_reads_elements_and_no_length() {
        let a = [7.0.to_any(), 8.0.to_any()].to_array().to_any::<A>();
        assert_eq!(option(a.clone().entry(1.0.to_any())), Some(8.0.to_any()));
        assert_eq!(option(a.clone().entry("1".into())), Some(8.0.to_any()));
        assert_eq!(option(a.clone().entry("2".into())), None);
        assert_eq!(option(a.entry("length".into())), None);
        let s: Any<A> = "ab".into();
        assert_eq!(option(s.clone().entry(1.0.to_any())), Some("b".into()));
        assert_eq!(option(s.entry("length".into())), None);
        assert_eq!(option(true.to_any::<A>().entry("0".into())), None);
        assert_eq!(option(5.0.to_any::<A>().entry("0".into())), None);
    }

    /// `undefined` and `null` are nullish, and nothing else is: not the
    /// falsy values, which `??` returns unchanged, nor an empty container.
    #[test]
    fn is_nullish() {
        assert_eq!(Any::<A>::undefined(), Nullish::Undefined.to_any());
        assert!(Any::<A>::undefined().is_nullish());
        assert!(Nullish::Null.to_any::<A>().is_nullish());
        for v in [
            false.to_any::<A>(),
            0.0.to_any(),
            f64::NAN.to_any(),
            "".into(),
            [].to_array().to_any(),
            [].to_object().to_any(),
        ] {
            assert!(!v.is_nullish());
        }
    }

    /// `undefined` alone is absent: `null` and the falsy values are
    /// arguments that were passed, and come back unchanged.
    #[test]
    fn defined() {
        assert!(Unpacked::from(Any::<A>::undefined()).is_undefined());
        assert!(!Unpacked::from(Nullish::Null.to_any::<A>()).is_undefined());
        assert_eq!(Any::<A>::undefined().defined(), None);
        for v in [
            Nullish::Null.to_any::<A>(),
            false.to_any(),
            0.0.to_any(),
            "".into(),
            [].to_array().to_any(),
            [].to_object().to_any(),
        ] {
            assert!(!Unpacked::from(v.clone()).is_undefined());
            assert_eq!(v.clone().defined(), Some(v));
        }
    }
}
