mod index;
mod partial_eq;
mod serializable;
mod sized_index;

pub mod to_string;

use crate::vm::IVm;

/// ```
/// use nanvm_lib::{
///     vm::{String, IVm, Any, ToString, naive::Naive, ToAny},
///     common::sized_index::SizedIndex,
/// };
/// fn string_test<A: IVm>() {
///     let a: String<A> = "Hello, world!".into();
///     assert_eq!(a.length(), 13);
///     assert_eq!(a[12], '!' as u16);
///     let b: String<A> = ['H' as u16, 'i' as u16, '!' as u16].to_string();
///     let c = a.clone() + b;
///     let ac: Any<A> = c.to_any();
///     let d: String<A> = ac.try_into().unwrap();
///     assert_eq!(d.length(), 16);
///     assert_eq!(format!("{d:?}"), r#""Hello, world!Hi!""#);
///     assert_eq!(char::decode_utf16(d.clone()).map(Result::unwrap).collect::<std::string::String>(), "Hello, world!Hi!");
///     let n = "Hello, world!Hi!".into();
///     assert_eq!(d, n);
///     assert_eq!(d, d);
///     assert_ne!(d, a);
/// }
///
/// string_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct String<A: IVm>(A::InternalString);
