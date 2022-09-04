use crate::{interface::Interface, guid::GUID};

pub struct IUnknown();

impl Interface for IUnknown {
    const GUID: GUID = 0x00000000_0000_0000_C000_000000000046;
}