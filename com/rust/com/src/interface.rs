use crate::guid::GUID;

pub trait Interface {
    const GUID: GUID;
}