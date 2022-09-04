mod class;
mod cobject;
mod guid;
mod hresult;
mod interface;
mod iunknown;
mod iunknownvmt;
mod object;
mod r#ref;
mod vmt;

pub use crate::{
    class::Class, cobject::CObject, guid::GUID, interface::Interface, object::Object, r#ref::Ref,
    vmt::Vmt,
};
