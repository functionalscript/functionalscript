use core::{marker::PhantomData, mem::forget};

trait Packable {
    /// Number of bits in the packed structure.
    const BIT_SIZE: u64;
    /// Moving ownership from `v` to `Self`.`
    fn unpack(v: u64) -> Self;
    /// Moving ownership from `self` to `u64`.
    fn pack(self) -> u64;
}

enum NaNEnum<T: Packable> {
    Number(f64),
    Else(T),
}

const NEGATIVE: u64 = 1 << 63;

const NOT_FINITE: u64 = 0b0111_1111_1111_0000 << 48;

const INFINITY: u64 = NOT_FINITE;

const NEG_INFINITY: u64 = INFINITY | NEGATIVE;

const NAN: u64 = NOT_FINITE | (1 << 51);

const ELSE: u64 = NAN | NEGATIVE;

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
struct NaNEnumPack<T: Packable>(u64, PhantomData<T>);

impl<T: Packable> NaNEnumPack<T> {
    const _A: () = assert!(T::BIT_SIZE <= 51);
    fn check(&self, mask: u64) -> bool {
        self.0 & mask == mask
    }
    unsafe fn unsafe_unpack(&self) -> NaNEnum<T> {
        if self.check(ELSE) {
            NaNEnum::Else(T::unpack(self.0))
        } else {
            NaNEnum::Number(f64::from_bits(self.0))
        }
    }
    fn unpack(self) -> NaNEnum<T> {
        let result = unsafe { self.unsafe_unpack() };
        forget(self);
        result
    }
    fn pack(v: NaNEnum<T>) -> Self {
        Self(
            match v {
                NaNEnum::Number(n) => n.to_bits(),
                NaNEnum::Else(e) => e.pack(),
            },
            PhantomData,
        )
    }
}

impl<T: Packable> Clone for NaNEnumPack<T> {
    fn clone(&self) -> Self {
        Self::pack(unsafe { self.unsafe_unpack() })
    }
}

impl<T: Packable> Drop for NaNEnumPack<T> {
    fn drop(&mut self) {
        unsafe { self.unsafe_unpack() };
    }
}

#[cfg(test)]
mod test {
    use core::mem::needs_drop;

    use crate::nanenum::{NEGATIVE, NOT_FINITE};

    // See https://doc.rust-lang.org/std/mem/fn.needs_drop.html

    trait Dropable {
        const _A: () = assert!(needs_drop::<Self>());
    }

    trait NonDropable {
        const _A: () = assert!(!needs_drop::<Self>());
    }

    #[test]
    fn test_f64() {
        assert_eq!(f64::INFINITY.to_bits(), NOT_FINITE);
        assert_eq!((f64::NEG_INFINITY).to_bits(), NOT_FINITE | NEGATIVE);
        assert_eq!(f64::NAN.to_bits(), NOT_FINITE | (1 << 51));
    }
}
