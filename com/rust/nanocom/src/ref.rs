use std::{
    cmp::Eq,
    fmt::{Debug, Formatter},
    ops::Deref,
};

use crate::object::Object;

#[repr(transparent)]
pub struct Ref<I: 'static = ()>(*const Object<I>);

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
        unsafe { (self.iunknown().Release)(self) };
    }
}

impl<I> Clone for Ref<I> {
    fn clone(&self) -> Self {
        self.deref().into()
    }
}

impl<I> From<&Object<I>> for Ref<I> {
    fn from(this: &Object<I>) -> Self {
        unsafe { (this.iunknown().AddRef)(this) };
        Self(this)
    }
}

impl<I> Debug for Ref<I> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_tuple("Ref").field(&self.0).finish()
    }
}

impl<I> PartialEq for Ref<I> {
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

impl<I> Eq for Ref<I> {}
