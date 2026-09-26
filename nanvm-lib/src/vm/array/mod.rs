mod at;
mod concat;
pub(crate) mod create;
mod includes;
mod index;
mod index_of;
mod last_index_of;
mod member_access;
mod partial_eq;
pub(crate) mod relative;
mod sized_index;
mod slice;
mod to_reversed;
mod to_spliced;
mod with;

pub mod to_array;

use crate::vm::IVm;

/// ```
/// use nanvm_lib::{
///     vm::{ToArray, IVm, Array, Any, Number, ToAny},
///     common::{sized_index::SizedIndex, default::default},
///     naive::Naive
/// };
/// fn array_test<A: IVm>() {
///     let b: Array<A> = [Number::from(1.0).to_any(), true.to_any()].to_array();
///     assert_eq!(b.length(), 2);
///     assert_eq!(b[0], Number::from(1.0).to_any());
///     assert_eq!(b[1], true.to_any());
///     let b1: Array<A> = [Number::from(1.0).to_any(), true.to_any()].to_array();
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
