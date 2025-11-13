use core::fmt;
use std::{io, ops::Index};

use crate::{
    common::{array::SizedIndex, serializable::Serializable},
    vm::{
        internal::ContainerIterator, number_coercion::NumberCoercion, string16::Join,
        string_coercion::StringCoercion, Any, IContainer, IVm, String16, Unpacked,
    },
};

/// ```
/// use nanvm_lib::{
///     vm::{ToArray, IVm, Array, Any, ToAny, naive::Naive},
///     common::{array::SizedIndex, default::default},
/// };
/// fn array_test<A: IVm>() {
///     let b: Array<A> = [1.0.to_any(), true.to_any()].to_array();
///     assert_eq!(b.length(), 2);
///     assert_eq!(b[0], 1.0.to_any());
///     assert_eq!(b[1], true.to_any());
///     let b1: Array<A> = [1.0.to_any(), true.to_any()].to_array();
///     assert_eq!(b, b);
///     assert_ne!(b, b1);
///     let ac: Any<A> = b.clone().to_any();
///     let d: Array<A> = ac.try_into().unwrap();
///     assert_eq!(d, b);
///     let e0: Array<A> = default();
///     let e1: Array<A> = [].to_array();
///     assert_ne!(e0, e1);
/// }
///
/// array_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct Array<A: IVm>(A::InternalArray);

impl<A: IVm> Default for Array<A> {
    fn default() -> Self {
        [].to_array()
    }
}

impl<A: IVm> IntoIterator for Array<A> {
    type Item = Any<A>;
    type IntoIter = ContainerIterator<A, A::InternalArray>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.items_iter()
    }
}

impl<A: IVm> Index<u32> for Array<A> {
    type Output = Any<A>;
    /// Currently panics if out of bounds.
    /// TODO: Future versions may change to return `Nullish::Undefined`.
    fn index(&self, index: u32) -> &Self::Output {
        self.0.items().index(index as usize)
    }
}

impl<A: IVm> SizedIndex<u32> for Array<A> {
    fn length(&self) -> u32 {
        self.0.items().length() as u32
    }
}

impl<A: IVm> PartialEq for Array<A> {
    fn eq(&self, other: &Self) -> bool {
        self.0.ptr_eq(&other.0)
    }
}

impl<A: IVm> TryFrom<Any<A>> for Array<A> {
    type Error = ();
    fn try_from(value: Any<A>) -> Result<Self, Self::Error> {
        if let Unpacked::Array(result) = value.into() {
            Ok(result)
        } else {
            Err(())
        }
    }
}

impl<A: IVm> fmt::Debug for Array<A> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.items_fmt('[', ']', f)
    }
}

impl<A: IVm> Serializable for Array<A> {
    fn serialize(self, writer: &mut impl io::Write) -> io::Result<()> {
        self.0.serialize(writer)
    }
    fn deserialize(reader: &mut impl io::Read) -> io::Result<Self> {
        A::InternalArray::deserialize(reader).map(Self)
    }
}

pub trait ToArray {
    fn to_array<A: IVm>(self) -> Array<A>
    where
        Self: Sized + IntoIterator<Item = Any<A>>,
    {
        Array(A::InternalArray::new_ok((), self))
    }
}

impl<T> ToArray for T {}

impl<A: IVm> StringCoercion<A> for Array<A> {
    fn coerce_to_string(self) -> Result<String16<A>, Any<A>> {
        self.0
            .items_iter()
            .map(|v| v.coerce_to_string())
            .join(",".into())
    }
}

impl<A: IVm> NumberCoercion<A> for Array<A> {
    fn coerce_to_number(self) -> Result<f64, Any<A>> {
        todo!()
    }
}
