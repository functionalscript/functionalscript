use crate::guid::GUID;

pub trait Interface: 'static {
    const GUID: GUID;
}

impl Interface for () {
    const GUID: GUID = 0x00000000_0000_0000_C000_000000000046;
}
