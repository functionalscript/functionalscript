use std::ops::Deref;

use crate::object::Object;

#[repr(transparent)]
pub struct Ref<I: 'static>(*const Object<I>);

impl<I: 'static> Ref<I> {
    pub unsafe fn from_raw(p: *const Object<I>) -> Ref<I> {
        Ref(p)
    }
}

impl<I> Deref for Ref<I> {
    type Target = Object<I>;
    fn deref(&self) -> &Self::Target {
        let p = self.0;
        unsafe { &*p }
    }
}

impl<I> Drop for Ref<I> {
    fn drop(&mut self) {
        unsafe { (self.vmt().iunknown.Release)(self) };
    }
}

impl<I> Clone for Ref<I> {
    fn clone(&self) -> Self {
        self.deref().into()
    }
}

impl<I> From<&Object<I>> for Ref<I> {
    fn from(this: &Object<I>) -> Self {
        unsafe { (this.vmt().iunknown.AddRef)(this) };
        Self(this)
    }
}
