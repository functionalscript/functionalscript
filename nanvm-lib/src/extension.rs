use crate::interface::{Any, Unpacked, Nullish, Instance};

fn string<A: Any>(c: &str) -> A::String {
    A::String::new((), c.encode_utf16().into_iter())
}

pub trait AnyExtension: Any {
    fn to_string(self) -> Self::String {
        match self.unpack() {
            Unpacked::Nullish(v) => string::<Self>(match v {
                Nullish::Null => "null",
                Nullish::Undefined => "undefined",
            }),
            Unpacked::Bool(v) => string::<Self>(match v {
                true => "true",
                false => "false"
            }),
            Unpacked::Number(_) => todo!(),
            Unpacked::String(v) => v,
            Unpacked::BigInt(_) => todo!(),
            Unpacked::Array(_) => Self::String::new((), []),
            Unpacked::Object(_) => string::<Self>("[object Object"),
            Unpacked::Function(_) => todo!(),
        }
    }
}

impl<T: Any> AnyExtension for T {}

#[cfg(test)]
mod test {
    use crate::{interface::{Instance, Nullish}, naive::{Any, Object}};

    use super::{string, AnyExtension};

    #[test]
    fn test_string() {
        let s = string::<Any>("Hello world!");
        let xs: Any = s.clone().into();
        let sxs = xs.to_string();
        assert_eq!(s, sxs);
    }

    #[test]
    fn test_nullish() {
        {
            let x: Any = Nullish::Null.into();
            assert_eq!(string::<Any>("null"), x.to_string());
        }
        {
            let x: Any = Nullish::Undefined.into();
            assert_eq!(string::<Any>("undefined"), x.to_string());
        }
    }

    #[test]
    fn test_boolean() {
        {
            let x: Any = true.into();
            assert_eq!(string::<Any>("true"), x.to_string());
        }
        {
            let x: Any = false.into();
            assert_eq!(string::<Any>("false"), x.to_string());
        }
    }

    #[test]
    fn test_object() {
        let x: Any = Object::new((), []).into();
        assert_eq!(string::<Any>("[object Object"), x.to_string());
    }
}
