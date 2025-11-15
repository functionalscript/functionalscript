mod index;
mod into_iterator;
mod partial_eq;
mod serializable;
mod sized_index;

pub mod to_string16;

use crate::vm::IVm;

/// ```
/// use nanvm_lib::{
///     vm::{String16, IVm, Any, ToString16, naive::Naive, ToAny},
///     common::sized_index::SizedIndex,
/// };
/// fn string_test<A: IVm>() {
///     let a: String16<A> = "Hello, world!".into();
///     assert_eq!(a.length(), 13);
///     assert_eq!(a[12], '!' as u16);
///     let b: String16<A> = ['H' as u16, 'i' as u16, '!' as u16].to_string16();
///     let c = a.clone() + b;
///     let ac: Any<A> = c.to_any();
///     let d: String16<A> = ac.try_into().unwrap();
///     assert_eq!(d.length(), 16);
///     assert_eq!(format!("{d:?}"), r#""Hello, world!Hi!""#);
///     assert_eq!(char::decode_utf16(d.clone()).map(Result::unwrap).collect::<String>(), "Hello, world!Hi!");
///     let n = "Hello, world!Hi!".into();
///     assert_eq!(d, n);
///     assert_eq!(d, d);
///     assert_ne!(d, a);
/// }
///
/// string_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct String16<A: IVm>(A::InternalString16);
