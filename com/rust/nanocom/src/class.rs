use crate::{CObject, Interface, Object, Ref, Vmt};

pub trait Class: Sized {
    type Interface: Interface;
    fn static_vmt() -> &'static Vmt<Self::Interface>;
    fn cobject_new(self) -> Ref<Self::Interface> {
        CObject::new(self)
    }
    unsafe fn downcast_unchecked(this: &Object<Self::Interface>) -> &CObject<Self> {
        let p = this as *const Object<Self::Interface> as *const CObject<Self>;
        &*p
    }
}
