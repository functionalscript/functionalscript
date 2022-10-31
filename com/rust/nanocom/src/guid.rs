use crate::Interface;

pub type GUID = u128;

pub trait GuidEx: Interface {
    const PLATFORM_GUID: GUID = {
        let x = Self::GUID;
        (x >> 96)
            | ((x >> 48) & 0x00000_000_0000_0000_0000_FFFF_0000_0000)
            | ((x >> 16) & 0x0000_0000_0000_0000_FFFF_0000_0000_0000)
            | (((x as u64).swap_bytes() as u128) << 64)
    };
}

impl<T: Interface> GuidEx for T {}
