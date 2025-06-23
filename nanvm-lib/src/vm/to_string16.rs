use crate::{nullish::Nullish, vm::{IInternalAny, String16}};

pub trait ToString16<A: IInternalAny> {
    fn to_string16(&self) -> String16<A>;
}

impl<A: IInternalAny> ToString16<A> for bool {
    fn to_string16(&self) -> String16<A> {
        if *self {
            "true".into()
        } else {
            "false".into()
        }
    }
}

impl<A: IInternalAny> ToString16<A> for Nullish {
    fn to_string16(&self) -> String16<A> {
        match self {
            Nullish::Null => "null".into(),
            Nullish::Undefined => "undefined".into(),
        }
    }
}

impl<A: IInternalAny> ToString16<A> for f64 {
    fn to_string16(&self) -> String16<A> {
        self.to_string().as_str().into()
    }
}
