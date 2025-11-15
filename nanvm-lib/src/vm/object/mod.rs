mod index;
mod into_iterator;
mod partial_eq;
mod serializable;
mod sized_index;

pub mod property;
pub mod to_object;

use crate::vm::IVm;

/// ```
/// use nanvm_lib::vm::{Object, ToObject, IVm, Array, Any, ToAny, naive::Naive};
/// fn object_test<A: IVm>() {
///     let b: Object<A> = [("a".into(), true.to_any())].to_object();
///     let b1: Object<A> = [("a".into(), true.to_any())].to_object();
///     assert_eq!(b, b);
///     assert_ne!(b, b1);
///     let ac: Any<A> = b.clone().to_any();
///     let d: Object<A> = ac.try_into().unwrap();
///     assert_eq!(d, b);
/// }
///
/// object_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct Object<A: IVm>(A::InternalObject);
