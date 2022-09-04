use crate::guid::GUID;

pub trait Interface: 'static {
    const GUID: GUID;
}