use crate::interface2::Unknown;

#[derive(PartialEq, Clone)]
pub enum Simple {
    Null,
    Undefined,
    Boolean(bool),
    Number(f64),
}

impl Simple {
    fn to_unknown<U: Unknown>(self) -> U {
        U::new_simple(self)
    }
}
