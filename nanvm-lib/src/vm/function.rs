use crate::{common::default::default, vm::{Any, IContainer, IInternalAny, String16, ToString16, Unpacked}};
use std::fmt::{Debug, Formatter};

pub type FunctionHeader<A> = (String16<A>, u32);

#[derive(Clone)]
pub struct Function<A: IInternalAny>(pub A::InternalFunction);

impl<A: IInternalAny> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for Function<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Function(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IInternalAny> Debug for Function<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let header = self.0.header();
        let name: std::string::String = (&header.0).into();
        let args = (0..header.1)
            .map(|i| format!("a{}", i))
            .collect::<Vec<_>>()
            .join(",");
        write!(f, "function {name}({args}) {{")?;
        for i in 0..self.0.len() {
            write!(f, "{:02X}", self.0.at(i))?;
        }
        f.write_str("}}")
    }
}

impl<A: IInternalAny> ToString16<A> for Function<A> {
    fn to_string16(&self) -> String16<A> {
        // TODO: Implement proper conversion to String16
        default()
    }
}
