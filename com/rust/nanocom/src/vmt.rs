use crate::iunknown::IUnknown;

#[repr(C)]
pub struct Vmt<I: 'static> {
    pub iunknown: IUnknown<I>,
    pub interface: I,
}
