use crate::{interface::{Any, List, Unpacked}, nullish::Nullish::*};

pub trait AnyExtension: Any {
    fn string(c: &str) -> Self::String {
        Self::String::new(c.encode_utf16().into_iter())
    }
    fn to_string(self) -> Self::String {
        match self.unpack() {
            Unpacked::Nullish(v) => Self::string(match v {
                Null => "null",
                Undefined => "undefined",
            }),
            Unpacked::Bool(v) => Self::string(match v {
                true => "true",
                false => "false",
            }),
            Unpacked::Number(_) => todo!(),
            Unpacked::String(v) => v,
            Unpacked::BigInt(_) => todo!(),
            Unpacked::Array(_) => Self::String::new([]),
            Unpacked::Object(_) => Self::string("[object Object"),
            Unpacked::Function(_) => todo!(),
        }
    }
    fn own_property(self, i: Self) -> Self {
        match self.unpack() {
            Unpacked::Nullish(_) => panic!("own_property(\"nullish\")"),
            Unpacked::Bool(_) => Undefined.into(),
            Unpacked::Number(_) => todo!(),
            Unpacked::String(_) => todo!(),
            Unpacked::BigInt(_) => todo!(),
            Unpacked::Array(_) => match i.unpack() {
                Unpacked::Nullish(_) => todo!(),
                Unpacked::Bool(_) => todo!(),
                Unpacked::Number(_) => todo!(),
                Unpacked::String(_) => todo!(),
                Unpacked::BigInt(_) => todo!(),
                Unpacked::Array(_) => todo!(),
                Unpacked::Object(_) => todo!(),
                Unpacked::Function(_) => todo!(),
            },
            Unpacked::Object(_) => todo!(),
            Unpacked::Function(_) => todo!(),
        }
    }
}

impl<T: Any> AnyExtension for T {}

#[cfg(test)]
mod test {
    mod to_string {
        use crate::{
            extension::AnyExtension, interface::PrefixList, naive::{Any, Array, Object}, nullish::Nullish::*
        };

        #[test]
        fn test_string() {
            let s = Any::string("Hello world!");
            let xs: Any = s.clone().into();
            let sxs = xs.to_string();
            assert_eq!(s, sxs);
        }

        #[test]
        fn test_nullish() {
            {
                let x: Any = Null.into();
                assert_eq!(Any::string("null"), x.to_string());
            }
            {
                let x: Any = Undefined.into();
                assert_eq!(Any::string("undefined"), x.to_string());
            }
        }

        #[test]
        fn test_boolean() {
            {
                let x: Any = true.into();
                assert_eq!(Any::string("true"), x.to_string());
            }
            {
                let x: Any = false.into();
                assert_eq!(Any::string("false"), x.to_string());
            }
        }

        #[test]
        fn test_object() {
            let x: Any = Object::new((), []).into();
            assert_eq!(Any::string("[object Object"), x.to_string());
        }

        #[test]
        fn test_array() {
            let x: Any = Array::new((), []).into();
            assert_eq!(Any::string(""), x.to_string());
        }
    }

    mod own_property {
        use crate::{extension::AnyExtension, naive::Any, nullish::Nullish::*};

        #[test]
        #[should_panic]
        fn test_own_property_null() {
            let x: Any = Null.into();
            x.own_property(Any::string("hello").into());
        }

        #[test]
        fn test_own_property_bool() {
            let x: Any = true.into();
            let undefined: Any = Undefined.into();
            assert_eq!(undefined, x.own_property(Any::string("hello").into()));
        }
    }
}
