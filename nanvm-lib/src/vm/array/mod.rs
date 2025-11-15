mod index;
mod into_iterator;
mod partial_eq;
mod serializable;
mod sized_index;

pub mod to_array;

use crate::vm::IVm;

/// ```
/// use nanvm_lib::{
///     vm::{ToArray, IVm, Array, Any, ToAny, naive::Naive},
///     common::{sized_index::SizedIndex, default::default},
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
