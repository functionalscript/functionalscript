use crate::{CObject, Interface, Ref, Vmt};

pub trait Class: Sized {
    type Interface: Interface;
    fn static_vmt() -> &'static Vmt<Self::Interface>;
    fn cobject_new(self) -> Ref<Self::Interface> {
        CObject::new(self)
    }
}
