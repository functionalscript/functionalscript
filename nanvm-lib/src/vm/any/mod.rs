mod add;
mod and;
mod bitand;
mod bitor;
mod bitxor;
mod conditional;
mod div;
mod from;
mod neg;
mod not;
mod nullish_coalescing;
mod or;
mod partial_eq;
mod relational;
mod rem;
mod shl;
mod shr;
mod sub;
mod typeof_;

pub mod to_any;

use crate::{
    common::sized_index::SizedIndex,
    vm::{
        Array, IVm, String, ToAny, Unpacked,
        boolean_coercion::BooleanCoercion,
        dispatch::Dispatch,
        nullish::Nullish,
        number_coercion::NumberCoercion,
        numeric::Numeric,
        primitive::Primitive,
        primitive_coercion::{PrimitiveCoercionOp, ToPrimitivePreferredType},
        string_coercion::StringCoercion,
    },
};

/// `Object.getOwnPropertyDescriptor`'s own message for a nullish receiver
/// (one of `own_property`'s two throwing cases, the other being a
/// non-`String` key — see its doc comment).
const CANNOT_CONVERT_NULLISH_TO_OBJECT: &str =
    "TypeError: Cannot convert undefined or null to object";

/// ```
/// use nanvm_lib::{
///     vm::{Any, IVm, ToAny, String, Array, ToArray, ToObject, Object, Nullish, BigInt},
///     naive::Naive
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

    /// The EDAG's `own` — exactly
    /// `Object.getOwnPropertyDescriptor(self, key)?.value`, no getter
    /// invocation, no prototype chain (`nanvm-lib` objects have no
    /// `__proto__` to walk in the first place). Not a `core::ops` trait —
    /// no Rust operator fits a keyed property lookup — so this is a plain
    /// method, the same as `pow`/`bitwise_not`/`unsigned_right_shift`.
    ///
    /// `key` must itself be a `String` — a runtime-value constraint the
    /// EDAG's shape-only schema can't express, upheld by whatever builds
    /// the `own` node in the first place, not by any coercion here (unlike
    /// real JS's `ToPropertyKey`, which would silently stringify a
    /// `Number` key rather than reject it). A non-`String` key is a
    /// `TypeError` here, the same as reaching `own` with one is a bug
    /// upstream, not a value for this to coerce past.
    ///
    /// A non-nullish, non-`Object` receiver is never an own-property owner
    /// (a `Number`/`String`/`Array`/etc. — none of these are the plain
    /// objects `own_property` inspects) and always answers `undefined`,
    /// same as every absent key does; a nullish one throws, matching
    /// `ToObject`'s own `TypeError` on `null`/`undefined`.
    ///
    /// The receiver is checked before the key is: real `ToObject` runs
    /// before `ToPropertyKey`
    /// (<https://tc39.es/ecma262/#sec-object.getownpropertydescriptor>), so
    /// a nullish receiver throws regardless of what the key is, even one
    /// this would otherwise reject — `Object.getOwnPropertyDescriptor(null,
    /// 42)` throws the nullish `TypeError`, not one about `42`.
    pub fn own_property(self, key: Self) -> Result<Self, Self> {
        let unpacked: Unpacked<A> = self.into();
        if let Unpacked::Nullish(_) = &unpacked {
            return Err(CANNOT_CONVERT_NULLISH_TO_OBJECT.into());
        }
        let key: String<A> = key.try_into()?;
        Ok(match unpacked {
            Unpacked::Object(o) => o
                .own_property(&key)
                .unwrap_or_else(|| Nullish::Undefined.to_any()),
            _ => Nullish::Undefined.to_any(),
        })
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

    /// The EDAG's `.` / `[]` (`['.', receiver, index]`) — see
    /// `nanvm-lib/todo/member-access-operator.md` for the staged plan.
    /// Stage 1 only: an `Array` receiver, indexed by an in-bounds integer
    /// key — given as a `Number` or its canonical decimal string — reads
    /// the element; the string key `"length"` reads `Array::length()`;
    /// every other key reads `undefined`. Every other receiver is Stage
    /// 2/3's job and is not implemented yet.
    ///
    /// Unlike `own_property`, this never panics on an out-of-range index:
    /// `array_member_access` checks `index < len` itself before it ever
    /// indexes into `Array<A>`, so `Array`'s own `Index<u32>` (which still
    /// panics out of bounds, by ordinary Rust convention — see
    /// `vm/array/index.rs`) is never reached with a bad index.
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
            Unpacked::Array(a) => array_member_access(a, key),
            // Stage 2 (String) and Stage 3 (Object, plus the fallback
            // `undefined` for Number/Boolean/BigInt/Function) are not
            // implemented yet.
            _ => todo!(
                "member access on a non-Array receiver: see nanvm-lib/todo/member-access-operator.md"
            ),
        })
    }

    /// Never fails, unlike `to_number`/`to_string`/`to_numeric` — `ToBoolean`
    /// inspects the operand's type directly and never calls `ToPrimitive`.
    pub fn to_boolean(self) -> bool {
        self.dispatch(BooleanCoercion)
    }

    pub fn to_numeric(self) -> Result<Numeric<A>, Any<A>> {
        // https://tc39.es/ecma262/#sec-tonumeric
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

/// `array[key]`: an in-bounds index (`Number` or canonical decimal string)
/// reads the element, `"length"` reads the length, anything else is
/// `undefined`. `.length` is looked up only through the string key
/// `"length"` — never through a number, the way JS itself never lets
/// `array[array.length]` collide with `array["length"]`.
fn array_member_access<A: IVm>(array: Array<A>, key: Any<A>) -> Any<A> {
    let len = array.length();
    match Unpacked::from(key) {
        Unpacked::Number(n) => match canonical_index(n) {
            Some(i) if i < len => array[i].clone(),
            _ => Nullish::Undefined.to_any(),
        },
        Unpacked::String(s) => {
            if s == "length".into() {
                (len as f64).to_any()
            } else {
                match string_to_index(&s) {
                    Some(i) if i < len => array[i].clone(),
                    _ => Nullish::Undefined.to_any(),
                }
            }
        }
        _ => Nullish::Undefined.to_any(),
    }
}

/// A `Number` key that denotes a valid array index: a non-negative integer
/// that fits in `u32`. `-0.0` passes (`-0.0 < 0.0` is `false` and
/// `(-0.0).fract()` is `0.0`), matching real JS: a numeric `-0` key
/// stringifies to `"0"` and indexes element `0`, unlike the *string* key
/// `"-0"`, which `string_to_index` below rejects (it round-trips to `"0"`,
/// not back to itself, so it never denotes an index).
fn canonical_index(n: f64) -> Option<u32> {
    if !n.is_finite() || n < 0.0 || n.fract() != 0.0 || n > u32::MAX as f64 {
        return None;
    }
    Some(n as u32)
}

/// A `String` key that is the canonical decimal form of an array index:
/// `"0"`, or a nonempty run of ASCII digits with no leading zero. This is
/// deliberately narrower than `str::parse`, which alone would accept
/// `"01"` and `"+1"` — neither is `array[1]`'s key in real JS, only
/// `array["1"]` is, and admitting them here would make two different
/// strings read the same element.
fn string_to_index<A: IVm>(s: &String<A>) -> Option<u32> {
    let text: std::string::String = s.clone().into();
    if text == "0" {
        return Some(0);
    }
    let mut chars = text.chars();
    match chars.next() {
        Some(first) if first.is_ascii_digit() && first != '0' => {}
        _ => return None,
    }
    if !chars.as_str().bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, ToAny, ToArray, ToObject},
    };

    type A = Naive;

    /// A corpus `expected: throws` case can't tell the two check orders
    /// apart — `own(null, 1)` throws either way — so this compares the
    /// actual error instead of just the fact of throwing: the receiver is
    /// checked first (see `own_property`'s own doc comment), so a nullish
    /// receiver paired with a non-string key must still produce the
    /// nullish `TypeError`, not the key-type one.
    #[test]
    fn own_property_nullish_receiver_outranks_non_string_key() {
        let receiver = Nullish::Null.to_any::<A>();
        let key = (1f64).to_any::<A>();
        assert_eq!(
            receiver.own_property(key),
            Err("TypeError: Cannot convert undefined or null to object".into())
        );
    }

    fn array(items: impl IntoIterator<Item = f64>) -> Any<A> {
        let items: std::vec::Vec<Any<A>> = items.into_iter().map(|n| n.to_any::<A>()).collect();
        items.to_array::<A>().to_any::<A>()
    }

    #[test]
    fn array_numeric_index_reads_element() {
        let a = array([10.0, 20.0, 30.0]);
        assert_eq!(a.clone().member_access(0.0.to_any()), Ok(10.0.to_any()));
        assert_eq!(a.member_access(2.0.to_any()), Ok(30.0.to_any()));
    }

    /// A numeric `-0` key stringifies to `"0"` before it is ever used as a
    /// key, in real JS as here, so it reads the same element `0` does —
    /// unlike the *string* key `"-0"`, covered below.
    #[test]
    fn array_negative_zero_index_reads_first_element() {
        let a = array([10.0]);
        assert_eq!(a.member_access((-0.0f64).to_any()), Ok(10.0.to_any()));
    }

    #[test]
    fn array_out_of_range_numeric_index_is_undefined() {
        let a = array([10.0]);
        assert_eq!(
            a.member_access(1.0.to_any()),
            Ok(Nullish::Undefined.to_any())
        );
    }

    #[test]
    fn array_non_integer_or_negative_numeric_index_is_undefined() {
        let a = array([10.0]);
        assert_eq!(
            a.clone().member_access(0.5.to_any()),
            Ok(Nullish::Undefined.to_any())
        );
        assert_eq!(
            a.member_access((-1.0f64).to_any()),
            Ok(Nullish::Undefined.to_any())
        );
    }

    #[test]
    fn array_canonical_string_index_reads_element() {
        let a = array([10.0, 20.0]);
        assert_eq!(a.clone().member_access("0".into()), Ok(10.0.to_any()));
        assert_eq!(a.member_access("1".into()), Ok(20.0.to_any()));
    }

    /// None of these round-trip to themselves through `ToNumber` then
    /// `ToString` the way `"0"`/`"1"`/… do, so none of them is the
    /// canonical form of any index — admitting them would let two
    /// different strings read the same element.
    #[test]
    fn array_non_canonical_string_index_is_undefined() {
        let a = array([10.0]);
        for key in ["01", "+0", "1.0", " 0", "-0", ""] {
            assert_eq!(
                a.clone().member_access(key.into()),
                Ok(Nullish::Undefined.to_any()),
                "key {key:?} must not read an element"
            );
        }
    }

    #[test]
    fn array_length_key_reads_length() {
        let a = array([10.0, 20.0, 30.0]);
        assert_eq!(a.member_access("length".into()), Ok(3.0.to_any()));
    }

    /// `.length` is looked up only through the string key `"length"`; the
    /// number `3` on a 3-element array is a plain out-of-range index, not
    /// a second spelling of `.length`.
    #[test]
    fn array_length_is_not_reachable_by_number() {
        let a = array([10.0, 20.0, 30.0]);
        assert_eq!(
            a.member_access(3.0.to_any()),
            Ok(Nullish::Undefined.to_any())
        );
    }

    #[test]
    fn array_unrelated_key_is_undefined() {
        let a = array([10.0]);
        assert_eq!(
            a.member_access(true.to_any()),
            Ok(Nullish::Undefined.to_any())
        );
    }

    #[test]
    fn array_member_access_nullish_receiver_throws() {
        let receiver = Nullish::Undefined.to_any::<A>();
        assert_eq!(
            receiver.member_access(0.0.to_any()),
            Err("TypeError: Cannot convert undefined or null to object".into())
        );
    }

    /// Stage 2 (`String`) and Stage 3 (`Object`, and everything else) of
    /// `nanvm-lib/todo/member-access-operator.md` are not implemented yet.
    #[test]
    #[should_panic]
    fn member_access_on_a_non_array_receiver_is_not_implemented_yet() {
        let object: Any<A> = [].to_object::<A>().to_any();
        let _ = object.member_access(0.0.to_any());
    }
}
