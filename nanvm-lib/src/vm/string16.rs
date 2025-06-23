use crate::vm::{ToString16, Any, IContainer, IInternalAny, ToAnyEx, Unpacked};
use std::fmt::{Debug, Formatter, Write};

#[derive(Clone)]
pub struct String16<A: IInternalAny>(pub A::InternalString16);

impl<A: IInternalAny> Default for String16<A> {
    fn default() -> Self {
        String16(A::InternalString16::new_empty(()))
    }
}

impl<A: IInternalAny> From<&String16<A>> for std::string::String {
    fn from(value: &String16<A>) -> Self {
        String::from_utf16_lossy(&value.0.collect())
    }
}

impl<A: IInternalAny> From<&str> for String16<A> {
    fn from(value: &str) -> Self {
        String16(A::InternalString16::new_ok((), value.encode_utf16()))
    }
}

impl<A: IInternalAny> From<&str> for Any<A> {
    fn from(value: &str) -> Self {
        let s: String16<_> = value.into();
        s.to_any()
    }
}

impl<A: IInternalAny> PartialEq for String16<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.deep_eq(&other.0)
    }
}

impl<A: IInternalAny> Debug for String16<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_char('"')?;
        let utf8: String = self.into();
        for c in utf8.chars() {
            match c {
                '"' => f.write_str("\\\"")?,
                '\\' => f.write_str("\\\\")?,
                '\n' => f.write_str("\\n")?,
                '\r' => f.write_str("\\r")?,
                '\t' => f.write_str("\\t")?,
                '\x00'..='\x1F' | '\x7F' => write!(f, "\\u{:04X}", c as u32)?,
                _ => f.write_char(c)?,
            }
        }
        f.write_char('"')
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for String16<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::String(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IInternalAny> ToString16<A> for String16<A> {
    fn to_string16(&self) -> String16<A> {
        self.clone()
    }
}
