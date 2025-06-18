use core::{fmt, panic};
use std::{
    char::decode_utf16,
    ops::{Add, Div, Mul, Shl, Shr, Sub},
};

use crate::{big_int::BigInt, nullish::Nullish, sign::Sign, simple::Simple};

#[derive(PartialEq, Copy, Clone)]
pub enum CoercionHint {
    Default,
    String,
    Number,
}

impl fmt::Display for CoercionHint {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CoercionHint::Default => write!(f, "default"),
            CoercionHint::String => write!(f, "string"),
            CoercionHint::Number => write!(f, "number"),
        }
    }
}

#[derive(PartialEq, Copy, Clone)]
pub enum SymbolProperty {
    ToPrimitive,
}

pub trait Container: Clone {
    type Header;
    type Item;
    fn header(&self) -> &Self::Header;
    /// For now, we use a slice.
    /// We may change it in the future to support more sophisticated containers.
    fn items(&self) -> &[Self::Item];
    fn new(header: Self::Header, items: impl IntoIterator<Item = Self::Item>) -> Self;
}

pub trait Complex<U: Any>: PartialEq + Sized + Container {
    fn to_unknown(self) -> U;
    fn try_from_unknown(u: U) -> Result<Self, U>;
}

pub trait String16<U: Any<String16 = Self>>:
    Complex<U> + Container<Header = (), Item = u16>
{
    fn concat(self, other: Self) -> Self;
}

pub trait Array<U: Any<Array = Self>>: Complex<U> + Container<Header = (), Item = U> {}

pub trait Object<U: Any<Object = Self>>:
    Complex<U> + Container<Header = (), Item = (U::String16, U)>
{
}

pub trait Function<U: Any<Function = Self>>:
    Complex<U> + Container<Header = u32, Item = u8>
{
}

pub trait Any: PartialEq + Sized + Clone + fmt::Debug {
    type String16: String16<Self>;
    type BigInt: BigInt<Self>;
    type Array: Array<Self>;
    type Object: Object<Self>;
    type Function: Function<Self>;

    // For now for internal exception-throwing operations (e.g. unary_plus applied to BigInt) we use
    // an Any-wrapped string value (a message). Later on we might want to have a schematized
    // exception Any that would carry file, line, etc. along with the message string.
    fn exception(c: &str) -> Result<Self, Self> {
        Err(Self::pack(Unpacked::String16(c.to_string16::<Self>())))
    }

    fn pack(u: Unpacked<Self>) -> Self;
    fn unpack(self) -> Unpacked<Self>;

    fn new_simple(value: Simple) -> Self;
    fn try_to_simple(&self) -> Option<Simple>;

    fn try_to<C: Complex<Self>>(self) -> Result<C, Self> {
        C::try_from_unknown(self)
    }

    // Inspection methods - allow to check the type of the value without unpacking it.
    fn is_nullish(&self) -> bool;
    fn is_boolean(&self) -> bool;
    fn is_number(&self) -> bool;
    fn is_string16(&self) -> bool;
    fn is_bigint(&self) -> bool;
    fn is_array(&self) -> bool;
    fn is_object(&self) -> bool;
    fn is_function(&self) -> bool;
    fn is_primitive(&self) -> bool {
        self.is_nullish()
            || self.is_boolean()
            || self.is_number()
            || self.is_string16()
            || self.is_bigint()
    }
    fn is_object_like(&self) -> bool {
        !self.is_primitive()
    }
    fn is_numeric(&self) -> bool {
        self.is_number() || self.is_bigint()
    }

    fn to_string(self) -> Self::String16 {
        if let Some(simple) = self.try_to_simple() {
            return simple.to_string::<Self>();
        }
        if let Ok(v) = self.clone().try_to::<Self::String16>() {
            return v;
        }
        if let Ok(v) = self.clone().try_to::<Self::Array>() {
            if v.items().is_empty() {
                return "".to_string16::<Self>();
            }
            let mut s = Self::String16::new((), std::iter::empty());
            for item in v.items() {
                if !s.items().is_empty() {
                    s = s.concat(",".to_string16::<Self>());
                }
                s = s.concat(item.clone().to_string());
            }
            return s;
        }
        if self.clone().try_to::<Self::Object>().is_ok() {
            return "[object Object]".to_string16::<Self>();
        }
        // bigint and function
        todo!()
    }

    fn to_primitive(v: Self) -> Result<Self, Self> {
        Self::to_primitive_with_hint(v, CoercionHint::Default)
    }

    fn to_primitive_with_hint(v: Self, hint: CoercionHint) -> Result<Self, Self> {
        // See https://tc39.es/ecma262/#sec-toprimitive,
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Data_structures#primitive_coercion

        // If v is a primitive value already, return it.
        if v.is_primitive() {
            return Ok(v);
        }

        // If v has Symbol.toPrimitive:
        // 1. Return TypeError if that property is not a function.
        // 2. Call that function with the given hint.
        // 3. If the result is a primitive value, return it; otherwise, return TypeError.
        if let Some(symbol_to_primitive) = Self::get_property(&v, "@@toPrimitive") {
            if !symbol_to_primitive.is_function() {
                return Self::exception("TypeError: Symbol.toPrimitive is not a function");
            }
            let v = Self::call_method(
                v,
                symbol_to_primitive,
                std::iter::once(Self::pack(Unpacked::String16(
                    hint.to_string().to_string16::<Self>(),
                ))),
            )?;
            if v.is_primitive() {
                return Ok(v);
            } else {
                return Self::exception(
                    "TypeError: Symbol.toPrimitive did not return a primitive value",
                );
            }
        }

        Self::ordinary_to_primitive(v, hint)
    }

    fn ordinary_to_primitive(v: Self, hint: CoercionHint) -> Result<Self, Self> {
        // See https://tc39.es/ecma262/#sec-ordinarytoprimitive

        if !v.is_object_like() {
            panic!("ordinary_to_primitive called on a non-object-like value");
        }

        // For "string" hint, we use "toString" method first, then "valueOf". Otherwise, we use
        // "valueOf" first, then "toString". Let's do that in a for loop over two boolean values.
        let to_string_calls = if hint == CoercionHint::String {
            [true, false]
        } else {
            [false, true]
        };
        for to_string_call in to_string_calls {
            if to_string_call {
                let opt_result = Self::call_method_if_present(&v, "toString", std::iter::empty());
                if opt_result.is_some() {
                    let unwrapped = opt_result.unwrap()?;
                    if unwrapped.is_primitive() {
                        return Ok(unwrapped);
                    }
                } else {
                    // If the object does not have a user-defined "toString" method, we use the
                    // prototype's toString.
                    return Ok(v.to_string().to_unknown());
                }
            } else {
                let opt_result = Self::call_method_if_present(&v, "valueOf", std::iter::empty());
                if opt_result.is_some() {
                    let unwrapped = opt_result.unwrap()?;
                    if unwrapped.is_primitive() {
                        return Ok(unwrapped);
                    }
                }
                // Unlike to toString sequence, there is no 'else' here: prototype's valueOf returns
                // the non-primitive object itself, so we don't need to do anything here.
            }
        }

        Self::exception("TypeError: Cannot convert ordinary object to primitive value")
    }

    fn get_property(_v: &Self, _prop_name: &str) -> Option<Self> {
        // TODO: implement get_property for real.
        None
    }

    fn call_method_if_present(
        v: &Self,
        method_name: &str,
        _arguments: impl IntoIterator<Item = Self>,
    ) -> Option<Result<Self, Self>> {
        match Self::get_property(v, method_name) {
            Some(property) => {
                if property.is_function() {
                    Some(Self::call_method(v.clone(), property, std::iter::empty()))
                } else {
                    None
                }
            }
            None => None,
        }
    }

    fn call_method(
        _v: Self,
        _method: Self,
        _arguments: impl IntoIterator<Item = Self>,
    ) -> Result<Self, Self> {
        // TODO: implement call_method for real.
        Self::exception("Not implemented: call_method")
    }

    fn call_symbol_to_primitive(v: Self, _hint: CoercionHint) -> Result<Self, Self> {
        // TODO: inspect if v has [Symbol.toPrimitive] property; if it's not present, return Ok(v).
        // If that property is not a function, return TypeError.
        // Otherwise, call it with the given hint and return the result.
        Ok(v)
    }

    fn to_numeric(v: Self) -> Result<Self, Self> {
        // See https://tc39.es/ecma262/#sec-tonumeric,
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Data_structures#numeric_coercion.
        let primitive = Self::to_primitive(v)?;
        if primitive.is_numeric() {
            Ok(primitive)
        } else if primitive.is_nullish() {
            match primitive.unpack() {
                Unpacked::Nullish(Nullish::Null) => return Ok(Self::pack(Unpacked::Number(0.0))),
                Unpacked::Nullish(Nullish::Undefined) => {
                    return Ok(Self::pack(Unpacked::Number(f64::NAN)))
                }
                _ => panic!("to_numeric: an unrecognized nullish value"),
            }
        } else if primitive.is_boolean() {
            match primitive.unpack() {
                Unpacked::Bool(b) => {
                    return Ok(Self::pack(Unpacked::Number(if b { 1.0 } else { 0.0 })))
                }
                _ => panic!("to_numeric: an unrecognized boolean value"),
            }
        } else if primitive.is_string16() {
            match primitive.unpack() {
                Unpacked::String16(string16) => {
                    let items = string16.items();
                    if items.is_empty() {
                        return Ok(Self::pack(Unpacked::Number(0.0)));
                    }
                    let string: String = decode_utf16(items.iter().cloned())
                        .map(|r| r.unwrap_or('\u{FFFD}'))
                        .collect();
                    if let Ok(n) = string.parse::<f64>() {
                        return Ok(Self::pack(Unpacked::Number(n)));
                    } else {
                        return Ok(Self::pack(Unpacked::Number(f64::NAN)));
                    }
                }
                _ => panic!("to_numeric: an unrecognized string16 value"),
            }
        } else {
            panic!("to_numeric: an unrecognized primitive value")
        }
    }

    fn to_number(v: Self) -> Result<Self, Self> {
        // https://tc39.es/ecma262/#sec-tonumber
        // This is a helper function for unary_plus and unary_minus.
        if v.is_number() {
            return Ok(v);
        }
        if v.is_bigint() {
            // TODO: return TypeError for Symbol as well when we implement it.
            // BigInt cannot be converted to number directly, so we throw an exception.
            return Self::exception("TypeError: Cannot convert a BigInt value to a number");
        }
        // Now when we filtered out BigInt and Symbol, to_numeric will do the job.
        Self::to_numeric(v)
    }

    fn unary_plus(v: Self) -> Result<Self, Self> {
        // https://tc39.es/ecma262/#sec-unary-plus-operator
        Self::to_number(v)
    }

    fn unary_minus(v: Self) -> Result<Self, Self> {
        // https://tc39.es/ecma262/#sec-unary-minus-operator
        let v = Self::to_numeric(v)?;
        match v.unpack() {
            Unpacked::Number(v) => Ok(Self::new_simple(Simple::Number(-v))),
            Unpacked::BigInt(v) => Ok(Self::pack(Unpacked::BigInt(v.negate()))),
            _ => panic!("unary_minus: an unrecognized numeric value"),
        }
    }

    fn add(v1: Self, v2: Self) -> Result<Self, Self> {
        // See https://tc39.es/ecma262/#sec-addition-operator-plus,
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Addition.
        let v1 = Self::to_primitive(v1)?;
        let v2 = Self::to_primitive(v2)?;
        if v1.is_string16() || v2.is_string16() {
            return Ok(v1.to_string().concat(v2.to_string()).to_unknown());
        }
        let v1 = Self::to_numeric(v1)?;
        let v2 = Self::to_numeric(v2)?;
        match v1.unpack() {
            Unpacked::Number(v1) => match v2.unpack() {
                Unpacked::Number(v2) => Ok(Self::new_simple(Simple::Number(v1 + v2))),
                Unpacked::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                _ => panic!("add: v2 is not a recognized numeric type"),
            },
            Unpacked::BigInt(v1) => match v2.unpack() {
                Unpacked::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Unpacked::BigInt(v2) => Ok(Self::pack(Unpacked::BigInt(v1.add(v2)))),
                _ => panic!("add: v2 is not a recognized numeric type"),
            },
            _ => panic!("add: v1 is not a recognized numeric type"),
        }
    }

    fn sub(v1: Self, v2: Self) -> Result<Self, Self> {
        // See https://tc39.es/ecma262/#sec-subtraction-operator-minus,
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Subtraction.
        let v1 = Self::to_numeric(v1)?;
        let v2 = Self::to_numeric(v2)?;
        match v1.unpack() {
            Unpacked::Number(v1) => match v2.unpack() {
                Unpacked::Number(v2) => Ok(Self::new_simple(Simple::Number(v1 - v2))),
                Unpacked::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                _ => panic!("sub: v2 is not a recognized numeric type"),
            },
            Unpacked::BigInt(v1) => match v2.unpack() {
                Unpacked::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Unpacked::BigInt(v2) => Ok(Self::pack(Unpacked::BigInt(v1.sub(v2)))),
                _ => panic!("sub: v2 is not a recognized numeric type"),
            },
            _ => panic!("sub: v1 is not a recognized numeric type"),
        }
    }

    fn mul(v1: Self, v2: Self) -> Result<Self, Self> {
        // See https://tc39.es/ecma262/#sec-multiplicative-operators,
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Multiplication.
        let v1 = Self::to_numeric(v1)?;
        let v2 = Self::to_numeric(v2)?;
        match v1.unpack() {
            Unpacked::Number(v1) => match v2.unpack() {
                Unpacked::Number(v2) => Ok(Self::new_simple(Simple::Number(v1 * v2))),
                Unpacked::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                _ => panic!("mul: v2 is not a recognized numeric type"),
            },
            Unpacked::BigInt(v1) => match v2.unpack() {
                Unpacked::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Unpacked::BigInt(v2) => Ok(Self::pack(Unpacked::BigInt(v1.mul(v2)))),
                _ => panic!("mul: v2 is not a recognized numeric type"),
            },
            _ => panic!("mul: v1 is not a recognized numeric type"),
        }
    }

    fn div(v1: Self, v2: Self) -> Result<Self, Self> {
        // See https://tc39.es/ecma262/#sec-multiplicative-operators,
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Division.
        let v1 = Self::to_numeric(v1)?;
        let v2 = Self::to_numeric(v2)?;
        match v1.unpack() {
            Unpacked::Number(v1) => match v2.unpack() {
                Unpacked::Number(v2) => Ok(Self::new_simple(Simple::Number(v1 / v2))),
                Unpacked::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                _ => panic!("div: v2 is not a recognized numeric type"),
            },
            Unpacked::BigInt(v1) => match v2.unpack() {
                Unpacked::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Unpacked::BigInt(v2) => Ok(Self::pack(Unpacked::BigInt(v1.div(v2)))),
                _ => panic!("div: v2 is not a recognized numeric type"),
            },
            _ => panic!("div: v1 is not a recognized numeric type"),
        }
    }

    fn shl(v1: Self, v2: Self) -> Result<Self, Self> {
        // See https://tc39.es/ecma262/#sec-left-shift-operator,
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Left_shift.
        let v1 = Self::to_numeric(v1)?;
        let v2 = Self::to_numeric(v2)?;
        match v1.unpack() {
            Unpacked::Number(v1) => match v2.unpack() {
                Unpacked::Number(v2) => Ok(Self::new_simple(Simple::Number(
                    ((v1 as i128) << ((v2 as i128) & 0x1F)) as f64,
                ))),
                Unpacked::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                _ => panic!("shl: v2 is not a recognized numeric type"),
            },
            Unpacked::BigInt(v1) => match v2.unpack() {
                Unpacked::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Unpacked::BigInt(v2) => Ok(Self::pack(Unpacked::BigInt(v1.shl(v2)))),
                _ => panic!("div: v2 is not a recognized numeric type"),
            },
            _ => panic!("div: v1 is not a recognized numeric type"),
        }
    }

    fn shr(v1: Self, v2: Self) -> Result<Self, Self> {
        // See https://tc39.es/ecma262/#sec-right-shift-operator,
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Right_shift.
        let v1 = Self::to_numeric(v1)?;
        let v2 = Self::to_numeric(v2)?;
        match v1.unpack() {
            Unpacked::Number(v1) => match v2.unpack() {
                Unpacked::Number(v2) => Ok(Self::new_simple(Simple::Number(
                    ((v1 as i128) >> ((v2 as i128) & 0x1F)) as f64,
                ))),
                Unpacked::BigInt(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                _ => panic!("shl: v2 is not a recognized numeric type"),
            },
            Unpacked::BigInt(v1) => match v2.unpack() {
                Unpacked::Number(_) => Self::exception(
                    "TypeError: Cannot mix BigInt and other types, use explicit conversions",
                ),
                Unpacked::BigInt(v2) => Ok(Self::pack(Unpacked::BigInt(v1.shr(v2)))),
                _ => panic!("div: v2 is not a recognized numeric type"),
            },
            _ => panic!("div: v1 is not a recognized numeric type"),
        }
    }
}

#[derive(PartialEq, Debug, Clone)]
pub enum Unpacked<U: Any> {
    Nullish(Nullish),
    Bool(bool),
    Number(f64),
    String16(U::String16),
    BigInt(U::BigInt),
    Array(U::Array),
    Object(U::Object),
    Function(U::Function),
}

pub enum Numeric<U: Any> {
    Number(f64),
    BigInt(U::BigInt),
}

pub trait Extension: Sized {
    fn to_complex<C: Complex<impl Any> + Container<Header = ()>>(self) -> C
    where
        Self: IntoIterator<Item = C::Item>,
    {
        C::new((), self)
    }

    fn to_string16_unknown<U: Any>(self) -> U
    where
        Self: IntoIterator<Item = u16>,
    {
        self.to_complex::<U::String16>().to_unknown()
    }

    fn to_array_unknown(self) -> Self::Item
    where
        Self: IntoIterator<Item: Any>,
    {
        self.to_complex::<<Self::Item as Any>::Array>().to_unknown()
    }

    fn to_object_unknown<U: Any>(self) -> U
    where
        Self: IntoIterator<Item = (U::String16, U)>,
    {
        self.to_complex::<U::Object>().to_unknown()
    }
}

impl<T> Extension for T {}

// Utf8

pub trait Utf8 {
    fn to_string16<U: Any>(&self) -> U::String16;
    fn to_unknown<U: Any>(&self) -> U;
}

impl Utf8 for str {
    fn to_string16<U: Any>(&self) -> U::String16 {
        self.encode_utf16().to_complex()
    }

    fn to_unknown<U: Any>(&self) -> U {
        self.to_string16::<U>().to_unknown()
    }
}

/**
 *  WAny allows to implement operations on Any types.
 * */
#[repr(transparent)]
#[derive(Clone, Debug, PartialEq)]
pub struct WAny<T: Any>(T);

impl<T: Any> WAny<T> {
    pub fn big_int(header: Sign, items: impl IntoIterator<Item = u64>) -> Self {
        Self(T::BigInt::new(header, items).to_unknown())
    }
}

impl<T: Any> Add for WAny<T> {
    type Output = Result<Self, Self>;

    fn add(self, other: Self) -> Self::Output {
        T::add(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: Any> Div for WAny<T> {
    type Output = Result<Self, Self>;

    fn div(self, other: Self) -> Self::Output {
        T::div(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: Any> Mul for WAny<T> {
    type Output = Result<Self, Self>;

    fn mul(self, other: Self) -> Self::Output {
        T::mul(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: Any> Shl for WAny<T> {
    type Output = Result<Self, Self>;

    fn shl(self, other: Self) -> Self::Output {
        T::shl(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: Any> Shr for WAny<T> {
    type Output = Result<Self, Self>;

    fn shr(self, other: Self) -> Self::Output {
        T::shr(self.0, other.0).map(Self).map_err(Self)
    }
}

impl<T: Any> Sub for WAny<T> {
    type Output = Result<Self, Self>;

    fn sub(self, other: Self) -> Self::Output {
        T::sub(self.0, other.0).map(Self).map_err(Self)
    }
}
