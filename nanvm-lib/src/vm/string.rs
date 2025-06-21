use crate::vm::{Any, IContainer, IInternalAny, Unpacked};
use std::fmt::{Debug, Formatter, Write};

#[derive(Clone)]
pub struct String<A: IInternalAny>(pub A::InternalString);

impl<A: IInternalAny> Into<std::string::String> for &String<A> {
    fn into(self) -> std::string::String {
        std::string::String::from_utf16_lossy(&self.0.collect())
    }
}

impl<A: IInternalAny> PartialEq for String<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.deep_eq(&other.0)
    }
}

impl<A: IInternalAny> Debug for String<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.write_char('"')?;
        let utf8: std::string::String = self.into();
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

impl<A: IInternalAny> TryFrom<Any<A>> for String<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::String(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}
