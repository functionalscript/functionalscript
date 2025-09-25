#![cfg(test)]

use core::{marker::PhantomData, mem::forget};
use std::rc::Rc;

trait Raw64: Clone {
    /// Number of bits in the packed structure.
    const BIT_SIZE: u64;
    /// Moving ownership from `v` to `Self`.`
    unsafe fn from_raw64(v: u64) -> Self;
    /// Moving ownership from `self` to `u64`.
    unsafe fn into_raw64(self) -> u64;
}

impl<T> Raw64 for Rc<T> {
    const BIT_SIZE: u64 = 48;
    unsafe fn from_raw64(v: u64) -> Self {
        Rc::from_raw(v as _)
    }
    unsafe fn into_raw64(self) -> u64 {
        Rc::into_raw(self) as *const _ as _
    }
}

#[derive(Clone)]
enum NaNEnum<T: Raw64> {
    Number(f64),
    Else(T),
}

const NEGATIVE: u64 = 1 << 63;

const NOT_FINITE: u64 = 0b0111_1111_1111_0000 << 48;

const INFINITY: u64 = NOT_FINITE;

const NEG_INFINITY: u64 = INFINITY | NEGATIVE;

const NAN: u64 = NOT_FINITE | (1 << 51);

const ELSE: u64 = NAN | NEGATIVE;

const ELSE_DATA: u64 = (1 << 51) - 1;

//  INFINITY: 7FF0...
// -INFINITY: FFF0...
//  NAN     : 7FF8...
//  ELSE    : FFF8...
//  NUMBER  : ...

/// Represents packed implementation of `NaNEnum`.
///
/// Note: currently, only `2^51` values are allowed for `Else`.
///       However, there are `2^53 - 3` are available,
///       so it's possible to use more than 51 bits in the future.
struct NaNEnumPack<T: Raw64>(u64, PhantomData<T>);

impl<T: Raw64> NaNEnumPack<T> {
    fn check(&self, mask: u64) -> bool {
        self.0 & mask == mask
    }
    /// Creates a temporary object that should be `forget` after using.
    unsafe fn tmp_unpack(&self) -> NaNEnum<T> {
        if self.check(ELSE) {
            NaNEnum::Else(T::from_raw64(self.0 & ELSE_DATA))
        } else {
            NaNEnum::Number(f64::from_bits(self.0))
        }
    }
    fn unpack(self) -> NaNEnum<T> {
        let result = unsafe { self.tmp_unpack() };
        forget(self);
        result
    }
    fn pack(v: NaNEnum<T>) -> Self {
        assert!(T::BIT_SIZE <= 51);
        Self(
            match v {
                NaNEnum::Number(n) => n.to_bits(),
                NaNEnum::Else(e) => unsafe { e.into_raw64() | ELSE },
            },
            PhantomData,
        )
    }
}

impl<T: Raw64> Clone for NaNEnumPack<T> {
    fn clone(&self) -> Self {
        let tmp = unsafe { self.tmp_unpack() };
        let c = tmp.clone();
        forget(tmp);
        Self::pack(c)
    }
}

impl<T: Raw64> Drop for NaNEnumPack<T> {
    fn drop(&mut self) {
        unsafe { self.tmp_unpack() };
    }
}

#[cfg(test)]
mod test {
    use core::{
        mem::forget,
        ptr::null,
        sync::atomic::{AtomicUsize, Ordering},
    };
    use std::rc::Rc;

    use crate::{common::default::default, nanenum::{Raw64, INFINITY, NEGATIVE, NEG_INFINITY, NOT_FINITE}};

    use super::{NaNEnum, NaNEnumPack};

    // See https://doc.rust-lang.org/std/mem/fn.needs_drop.html

    /*
    trait Dropable {
        const _A: () = assert!(needs_drop::<Self>());
    }

    trait NonDropable {
        const _A: () = assert!(!needs_drop::<Self>());
    }
    */

    #[test]
    fn test_f64() {
        assert_eq!(f64::INFINITY.to_bits(), NOT_FINITE);
        assert_eq!((f64::NEG_INFINITY).to_bits(), NOT_FINITE | NEGATIVE);
        assert_eq!(f64::NAN.to_bits(), NOT_FINITE | (1 << 51));
    }

    #[test]
    fn test_pack() {
        static I: AtomicUsize = AtomicUsize::new(0);

        struct P();

        impl Default for P {
            fn default() -> Self {
                I.fetch_add(1, Ordering::Relaxed);
                Self()
            }
        }

        impl Clone for P {
            fn clone(&self) -> Self {
                default()
            }
        }

        impl Drop for P {
            fn drop(&mut self) {
                I.fetch_sub(1, Ordering::Relaxed);
            }
        }

        impl Raw64 for P {
            const BIT_SIZE: u64 = 0;
            unsafe fn from_raw64(_: u64) -> Self {
                Self()
            }
            unsafe fn into_raw64(self) -> u64 {
                forget(self);
                0
            }
        }

        //

        {
            assert_eq!(I.load(Ordering::Relaxed), 0);
            {
                let x = P::default();
                assert_eq!(I.load(Ordering::Relaxed), 1);
                let m = NaNEnum::Else(x);
                assert_eq!(I.load(Ordering::Relaxed), 1);
                let p = NaNEnumPack::pack(m);
                assert_eq!(I.load(Ordering::Relaxed), 1);
                let p1 = p.clone();
                assert_eq!(I.load(Ordering::Relaxed), 2);
                let m1 = p1.unpack();
                assert_eq!(I.load(Ordering::Relaxed), 2);
                if let NaNEnum::Else(x1) = m1 {
                    assert_eq!(I.load(Ordering::Relaxed), 2);
                    // assert_ne!(&x as *const _, null())
                    // assert_ne!(&m as *const _, null())
                    assert_ne!(&p as *const _, null());
                    // assert_ne!(&p1 as *const _, null());
                    // assert_ne!(&m1 as *const _, null());
                    assert_ne!(&x1 as *const _, null());
                } else {
                    panic!()
                }
            }
            assert_eq!(I.load(Ordering::Relaxed), 0);
        }

        //

        {
            assert_eq!(I.load(Ordering::Relaxed), 0);
            {
                let x = P::default();
                assert_eq!(I.load(Ordering::Relaxed), 1);
                let m = NaNEnum::Else(x.clone());
                assert_eq!(I.load(Ordering::Relaxed), 2);
                let p = NaNEnumPack::pack(m.clone());
                assert_eq!(I.load(Ordering::Relaxed), 3);
                let p1 = p.clone();
                assert_eq!(I.load(Ordering::Relaxed), 4);
                let m1 = p1.clone().unpack();
                assert_eq!(I.load(Ordering::Relaxed), 5);
                if let NaNEnum::Else(x1) = m1.clone() {
                    assert_eq!(I.load(Ordering::Relaxed), 6);
                    assert_ne!(&x as *const _, null());
                    assert_ne!(&m as *const _, null());
                    assert_ne!(&p as *const _, null());
                    assert_ne!(&p1 as *const _, null());
                    assert_ne!(&m1 as *const _, null());
                    assert_ne!(&x1 as *const _, null());
                } else {
                    panic!()
                }
            }
            assert_eq!(I.load(Ordering::Relaxed), 0);
        }
    }

    #[test]
    fn test_ptr() {
        let x = Rc::new("hello");
        let m = NaNEnum::Else(x);
        let p = NaNEnumPack::pack(m);
        let _p1 = p.clone();
    }

    // Use INFINITY, NEG_INFINITY in a test to avoid dead code warning
    #[test]
    fn test_infinity() {
        assert_eq!(INFINITY, NOT_FINITE);
        assert_eq!(NEG_INFINITY, NOT_FINITE | NEGATIVE);
    }
}
