use core::fmt::{self, Display, Formatter, Write};

use crate::vm::{
    Any, Array, BigInt, Function, IVm, Object, String, dispatch::Dispatch, nullish::Nullish,
};

/// An `Any<A>` shape [`Any::to_json`] does not (yet) know how to render.
///
/// Scoped deliberately: the walking-skeleton harness
/// (`todo/fjs-nanvm-integration.md`) only needs numbers, strings, booleans,
/// and `null`. Everything else here is a real ECMAScript value with no
/// direct JSON counterpart; `mvp-roadmap.md`'s open question 3 ("does the
/// MVP print DJS for those, or report an error?") is left for later — this
/// reports an error rather than guessing at a representation.
#[derive(Debug, PartialEq)]
pub enum JsonError {
    Undefined,
    NonFiniteNumber(f64),
    BigInt,
    Object,
    Array,
    Function,
}

impl Display for JsonError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            JsonError::Undefined => write!(f, "`undefined` has no JSON representation"),
            JsonError::NonFiniteNumber(v) => write!(f, "{v} has no JSON representation"),
            JsonError::BigInt => write!(f, "a BigInt has no JSON representation"),
            JsonError::Object => write!(f, "object-to-JSON serialization is not implemented yet"),
            JsonError::Array => write!(f, "array-to-JSON serialization is not implemented yet"),
            JsonError::Function => write!(f, "a function has no JSON representation"),
        }
    }
}

struct ToJson;

impl<A: IVm> Dispatch<A> for ToJson {
    type Result = Result<std::string::String, JsonError>;

    fn nullish(self, v: Nullish) -> Self::Result {
        match v {
            Nullish::Null => Ok("null".into()),
            Nullish::Undefined => Err(JsonError::Undefined),
        }
    }

    fn bool(self, v: bool) -> Self::Result {
        Ok(if v { "true" } else { "false" }.into())
    }

    fn number(self, v: f64) -> Self::Result {
        if !v.is_finite() {
            return Err(JsonError::NonFiniteNumber(v));
        }
        // `-0.0.to_string()` renders as `"-0"`, but ECMAScript's
        // `Number::toString` (and so `JSON.stringify(-0)`) renders `-0` as
        // `"0"` — the same special case `StringCoercion::number` already
        // makes (`string_coercion.rs`).
        if v == 0.0 {
            Ok("0".into())
        } else {
            Ok(v.to_string())
        }
    }

    fn string(self, v: String<A>) -> Self::Result {
        let mut out = std::string::String::from("\"");
        for r in char::decode_utf16(v) {
            match r {
                Ok('"') => out.push_str("\\\""),
                Ok('\\') => out.push_str("\\\\"),
                Ok('\n') => out.push_str("\\n"),
                Ok('\r') => out.push_str("\\r"),
                Ok('\t') => out.push_str("\\t"),
                Ok(c) if (c as u32) < 0x20 => {
                    let _ = write!(out, "\\u{:04x}", c as u32);
                }
                Ok(c) => out.push(c),
                // A lone UTF-16 surrogate has no Unicode text representation,
                // but well-formed JSON stringification (ES2019) still emits
                // it as its own `\uXXXX` escape rather than refusing the
                // whole string — the same convention this repository's own
                // JSON serializer follows
                // (`fjs/media/json/serializer/module.f.mjs`).
                Err(e) => {
                    let _ = write!(out, "\\u{:04x}", e.unpaired_surrogate());
                }
            }
        }
        out.push('"');
        Ok(out)
    }

    fn bigint(self, _: BigInt<A>) -> Self::Result {
        Err(JsonError::BigInt)
    }

    fn object(self, _: Object<A>) -> Self::Result {
        Err(JsonError::Object)
    }

    fn array(self, _: Array<A>) -> Self::Result {
        Err(JsonError::Array)
    }

    fn function(self, _: Function<A>) -> Self::Result {
        Err(JsonError::Function)
    }
}

impl<A: IVm> Any<A> {
    /// A minimal `Any<A>` -> JSON serializer, covering exactly what the
    /// walking-skeleton harness needs: numbers, strings, booleans, and
    /// `null`. See [`JsonError`] for what's deliberately unhandled.
    pub fn to_json(self) -> Result<std::string::String, JsonError> {
        self.dispatch(ToJson)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Function, IContainer, IVm, String, ToAny, ToArray, ToObject, ToString},
    };

    type A = Naive;

    fn s(v: &str) -> crate::vm::Any<A> {
        String::<A>::from(v).to_any()
    }

    #[test]
    fn number() {
        assert_eq!(42.0.to_any::<A>().to_json(), Ok("42".into()));
        assert_eq!((-1.5).to_any::<A>().to_json(), Ok("-1.5".into()));
    }

    #[test]
    fn negative_zero_renders_as_zero() {
        // ECMAScript's `Number::toString(-0)` (and so `JSON.stringify(-0)`)
        // is `"0"`, not `"-0"` — see `StringCoercion::number`'s same case.
        assert_eq!((-0.0).to_any::<A>().to_json(), Ok("0".into()));
    }

    #[test]
    fn non_finite_number_errors() {
        // `NaN != NaN`, so this checks the variant by pattern rather than
        // `assert_eq!` against a `JsonError::NonFiniteNumber(f64::NAN)`.
        assert!(matches!(
            f64::NAN.to_any::<A>().to_json(),
            Err(super::JsonError::NonFiniteNumber(v)) if v.is_nan()
        ));
        assert_eq!(
            f64::INFINITY.to_any::<A>().to_json(),
            Err(super::JsonError::NonFiniteNumber(f64::INFINITY))
        );
    }

    #[test]
    fn string() {
        assert_eq!(s("hello").to_json(), Ok(r#""hello""#.into()));
        assert_eq!(s("a\"b\\c\nd").to_json(), Ok(r#""a\"b\\c\nd""#.into()));
    }

    #[test]
    fn unpaired_surrogate_is_escaped_not_an_error() {
        let lone_high_surrogate: String<A> = [0xd800u16].to_string();
        assert_eq!(
            lone_high_surrogate.to_any::<A>().to_json(),
            Ok(r#""\ud800""#.into())
        );
    }

    #[test]
    fn bigint_errors() {
        let bi: crate::vm::BigInt<A> = 123u64.into();
        assert_eq!(bi.to_any::<A>().to_json(), Err(super::JsonError::BigInt));
    }

    #[test]
    fn object_errors() {
        let o = [].to_object::<A>();
        assert_eq!(o.to_any::<A>().to_json(), Err(super::JsonError::Object));
    }

    #[test]
    fn array_errors() {
        let a = [].to_array::<A>();
        assert_eq!(a.to_any::<A>().to_json(), Err(super::JsonError::Array));
    }

    #[test]
    fn function_errors() {
        let name: String<A> = "f".into();
        let f: Function<A> = Function(<A as IVm>::InternalFunction::new_ok((name, 0), []));
        assert_eq!(f.to_any::<A>().to_json(), Err(super::JsonError::Function));
    }

    #[test]
    fn boolean() {
        assert_eq!(true.to_any::<A>().to_json(), Ok("true".into()));
        assert_eq!(false.to_any::<A>().to_json(), Ok("false".into()));
    }

    #[test]
    fn null_and_undefined() {
        use crate::vm::Nullish;
        assert_eq!(Nullish::Null.to_any::<A>().to_json(), Ok("null".into()));
        assert_eq!(
            Nullish::Undefined.to_any::<A>().to_json(),
            Err(super::JsonError::Undefined)
        );
    }
}
