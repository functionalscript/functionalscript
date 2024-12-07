use core::{
    marker::PhantomData, mem::forget, ops::{Deref, DerefMut}
};
use std::rc::Rc;

/// Usually, a pointer uses only 48 LE bits.
/// See
/// - https://en.wikipedia.org/wiki/X86-64#Canonical_form_addresses
/// - https://8ksec.io/arm64-reversing-and-exploitation-part-10-intro-to-arm-memory-tagging-extension-mte/
///
/// Additional alignment can reduce number of useful bits even further:
/// - 2 bit alignment (u16) => 1 bit tag, 47;
/// - 4 bit alignment (u32) => 2 bit tag, 46;
/// - 8 bit alignment (u64) => 3 bit tag, 45;
/// - 16 bit alignment => 4 bit tag, 44.
struct Rc6<T>([u8; 6], PhantomData<T>);

impl<T> Rc6<T> {
    const _0: () = assert!(size_of::<Rc<T>>() <= 8);
    const _1: () = assert!(size_of::<Self>() == 6);
    unsafe fn ptr(&self) -> *mut T {
        let mut b = [0; 8];
        b[..6].clone_from_slice(&self.0);
        usize::from_le_bytes(b) as *mut _
    }
    unsafe fn rc(&self) -> Rc<T> {
        Rc::from_raw(self.ptr())
    }
}

impl<T> From<Rc<T>> for Rc6<T> {
    fn from(value: Rc<T>) -> Self {
        let mut result = Self([0; 6], PhantomData);
        result
            .0
            .clone_from_slice(&usize::to_le_bytes(Rc::into_raw(value) as usize)[..6]);
        result
    }
}

impl<T> Into<Rc<T>> for Rc6<T> {
    fn into(self) -> Rc<T> {
        let result = unsafe { self.rc() };
        forget(self);
        result
    }
}

impl<T> Deref for Rc6<T> {
    type Target = T;
    fn deref(&self) -> &T {
        unsafe { &*self.ptr() }
    }
}

impl<T> DerefMut for Rc6<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        unsafe { &mut *self.ptr() }
    }
}

impl<T> Drop for Rc6<T> {
    fn drop(&mut self) {
        unsafe { self.rc() };
    }
}

#[cfg(test)]
mod test {
    use std::rc::Rc;

    use super::Rc6;

    #[test]
    fn test() {
        let a = Rc::new(42);
        let b: Rc6<_> = a.into();
    }
}