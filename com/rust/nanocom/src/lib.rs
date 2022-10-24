mod class;
mod cobject;
mod guid;
mod hresult;
mod interface;
mod iunknown;
mod object;
mod r#ref;
mod vmt;

pub use crate::{
    class::Class,
    cobject::{CObject, CObjectEx},
    guid::GUID,
    interface::Interface,
    iunknown::IUnknown,
    object::Object,
    r#ref::Ref,
    vmt::Vmt,
};
