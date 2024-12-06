use crate::interface::{Any, List, Nullish, Unpacked};

fn string<A: Any>(c: &str) -> A::String {
    A::String::new(c.encode_utf16().into_iter())
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
                false => "false",
            }),
            Unpacked::Number(_) => todo!(),
            Unpacked::String(v) => v,
            Unpacked::BigInt(_) => todo!(),
            Unpacked::Array(_) => Self::String::new([]),
            Unpacked::Object(_) => string::<Self>("[object Object"),
            Unpacked::Function(_) => todo!(),
        }
    }
    fn own_property(self, i: Self) -> Self {
        match self.unpack() {
            Unpacked::Nullish(_) => panic!("own_property(\"nullish\")"),
            Unpacked::Bool(_) => Nullish::Undefined.into(),
            Unpacked::Number(_) => todo!(),
            Unpacked::String(_) => todo!(),
            Unpacked::BigInt(_) => todo!(),
            Unpacked::Array(v) => match i.unpack() {
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
            interface::{Nullish, PrefixList},
            naive::{Any, Array, Object},
            extension::{string, AnyExtension},
        };

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

        #[test]
        fn test_array() {
            let x: Any = Array::new((), []).into();
            assert_eq!(string::<Any>(""), x.to_string());
        }
    }

    mod own_property {
        use crate::{extension::{string, AnyExtension}, interface::Nullish, naive::Any};

        #[test]
        #[should_panic]
        fn test_own_property_null() {
            let x: Any = Nullish::Null.into();
            x.own_property(string::<Any>("hello").into());
        }

        #[test]
        fn test_own_property_bool() {
            let x: Any = true.into();
            let undefined: Any = Nullish::Undefined.into();
            assert_eq!(undefined, x.own_property(string::<Any>("hello").into()));
        }
    }
}
