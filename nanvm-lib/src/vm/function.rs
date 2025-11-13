use crate::{
    common::{array::SizedIndex, serializable::Serializable},
    vm::{
        number_coercion::NumberCoercion,
        string_coercion::{StringCoercion, ToString16Result},
        Any, IContainer, IVm, String16, Unpacked,
    },
};
use core::fmt::{Debug, Formatter, Write};
use std::io;

pub type FunctionHeader<A> = (String16<A>, u32);

// TODO: remove `pub` from the field when bytecode generator is implemented.
#[derive(Clone)]
pub struct Function<A: IVm>(pub A::InternalFunction);

impl<A: IVm> Function<A> {
    pub fn name(&self) -> &String16<A> {
        &self.0.header().0
    }
    pub fn length(&self) -> u32 {
        self.0.header().1
    }
}

impl<A: IVm> PartialEq for Function<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Function<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Function(result) = value.into() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> Debug for Function<A> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let name: String = self.name().clone().into();
        write!(f, "function {name}(")?;
        for i in 0..self.length() {
            if i != 0 {
                f.write_char(',')?;
            }
            write!(f, "a{i}")?;
        }
        f.write_str(") {")?;
        let items = self.0.items();
        for i in 0..items.length() {
            write!(f, "{:02X}", items[i])?;
        }
        f.write_char('}')
    }
}

impl<A: IVm> Serializable for Function<A> {
    fn serialize(self, write: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(write)
    }
    fn deserialize(read: &mut impl io::Read) -> io::Result<Self> {
        A::InternalFunction::deserialize(read).map(Self)
    }
}

impl<A: IVm> StringCoercion<A> for Function<A> {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        // TODO: invoke user-defined methods Symbol.toPrimitive, toString, valueOf.
        "[object Function]".to_string16_result()
    }
}

impl<A: IVm> NumberCoercion<A> for Function<A> {
    fn coerce_to_number(self) -> Result<f64, Any<A>> {
        todo!()
    }
}
