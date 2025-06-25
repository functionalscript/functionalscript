use crate::{
    common::{default::default, serializable::Serializable},
    vm::{Any, IContainer, IVm, Js, String16, Unpacked},
};
use std::{
    fmt::{Debug, Formatter},
    io,
};

pub type FunctionHeader<A> = (String16<A>, u32);

#[derive(Clone)]
pub struct Function<A: IVm>(pub A::InternalFunction);

impl<A: IVm> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Function<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Function(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> Debug for Function<A> {
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

impl<A: IVm> Js<A> for Function<A> {
    fn string(&self) -> String16<A> {
        // TODO: Implement proper conversion to String16
        default()
    }
}

impl<A: IVm> Serializable for Function<A> {
    fn serialize(&self, write: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(write)
    }

    fn deserialize(read: &mut impl io::Read) -> io::Result<Self> {
        A::InternalFunction::deserialize(read).map(Self)
    }
}
