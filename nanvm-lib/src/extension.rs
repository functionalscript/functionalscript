use crate::{
    interface::{Any, Extension, Unpacked},
    nullish::Nullish::*,
    simple::Simple,
};

pub trait AnyExtension: Any {
    fn string(c: &str) -> Self::String16 {
        c.encode_utf16().to_complex()
    }
    fn to_string(self) -> Self::String16 {
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
            Unpacked::String16(v) => v,
            Unpacked::BigInt(_) => todo!(),
            Unpacked::Array(_) => [].to_complex(),
            Unpacked::Object(_) => Self::string("[object Object"),
            Unpacked::Function(_) => todo!(),
        }
    }
    fn own_property(self, i: Self) -> Self {
        match self.unpack() {
            Unpacked::Nullish(_) => panic!("own_property(\"nullish\")"),
            Unpacked::Bool(_) => Simple::Nullish(Undefined).to_unknown(),
            Unpacked::Number(_) => todo!(),
            Unpacked::String16(_) => todo!(),
            Unpacked::BigInt(_) => todo!(),
            Unpacked::Array(_) => match i.unpack() {
                Unpacked::Nullish(_) => todo!(),
                Unpacked::Bool(_) => todo!(),
                Unpacked::Number(_) => todo!(),
                Unpacked::String16(_) => todo!(),
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
            extension::AnyExtension,
            interface::{Complex, Extension},
            naive::Any,
            nullish::Nullish::*,
            simple::Simple,
        };

        #[test]
        fn test_string() {
            let s = Any::string("Hello world!");
            let xs: Any = s.clone().to_unknown();
            let sxs = xs.to_string();
            assert_eq!(s, sxs);
        }

        #[test]
        fn test_nullish() {
            {
                let x: Any = Simple::Nullish(Null).to_unknown();
                assert_eq!(Any::string("null"), x.to_string());
            }
            {
                let x: Any = Simple::Nullish(Undefined).to_unknown();
                assert_eq!(Any::string("undefined"), x.to_string());
            }
        }

        #[test]
        fn test_boolean() {
            {
                let x: Any = Simple::Boolean(true).to_unknown();
                assert_eq!(Any::string("true"), x.to_string());
            }
            {
                let x: Any = Simple::Boolean(false).to_unknown();
                assert_eq!(Any::string("false"), x.to_string());
            }
        }

        #[test]
        fn test_object() {
            let x: Any = [].to_object_unknown();
            assert_eq!(Any::string("[object Object"), x.to_string());
        }

        #[test]
        fn test_array() {
            let x: Any = [].to_array_unknown();
            assert_eq!(Any::string(""), x.to_string());
        }
    }

    mod own_property {
        use crate::{
            extension::AnyExtension, interface::Complex, naive::Any, nullish::Nullish::*,
            simple::Simple,
        };

        // #[wasm_bindgen_test] // #[wasm-bindgen-test] doesn't work with `#[should_panic]`
        #[test]
        #[should_panic]
        fn test_own_property_null() {
            let x: Any = Simple::Nullish(Null).to_unknown();
            x.own_property(Any::string("hello").to_unknown());
        }

        #[test]
        fn test_own_property_bool() {
            let x: Any = Simple::Boolean(true).to_unknown();
            let undefined: Any = Simple::Nullish(Undefined).to_unknown();
            assert_eq!(undefined, x.own_property(Any::string("hello").to_unknown()));
        }
    }
}
