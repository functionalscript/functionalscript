use crate::vm::{Any, IContainer, IInternalAny, Unpacked};

#[derive(Clone)]
pub struct Array<A: IInternalAny>(pub A::InternalArray);

impl<A: IInternalAny> PartialEq for Array<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IInternalAny> TryFrom<Any<A>> for Array<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Array(result) = value.0.to_unpacked() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IInternalAny> std::fmt::Debug for Array<A> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[")?;
        let mut first = true;
        for i in 0..self.0.len() {
            if !first {
                write!(f, ",")?;
            }
            write!(f, "{:?}", self.0.at(i))?;
            first = false;
        }
        write!(f, "]")
    }
}
