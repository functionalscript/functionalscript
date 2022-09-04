use crate::iunknownvmt::IUnknownVmt;

#[repr(C)]
pub struct Vmt<I: 'static> {
    pub iunknown: IUnknownVmt<I>,
    pub interface: I,
}
