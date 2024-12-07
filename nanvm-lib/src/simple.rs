use crate::{
    interface2::{Unknown, Utf8},
    nullish::Nullish,
};

#[derive(PartialEq, Debug, Clone)]
pub enum Simple {
    Nullish(Nullish),
    Boolean(bool),
    Number(f64),
}

impl Simple {
    pub fn to_unknown<U: Unknown>(self) -> U {
        U::new_simple(self)
    }
    pub fn to_string<U: Unknown>(self) -> U::String16 {
        match self {
            Simple::Nullish(v) => (match v {
                Nullish::Null => "null",
                Nullish::Undefined => "undefined",
            })
            .to_string16::<U>(),
            Simple::Boolean(v) => (match v {
                true => "true",
                false => "false",
            })
            .to_string16::<U>(),
            Simple::Number(_) => todo!(),
        }
    }
}
