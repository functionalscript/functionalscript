#[allow(non_camel_case_types)]
#[repr(u32)]
#[derive(Debug)]
pub enum HRESULT {
    S_OK = 0,
    E_NOINTERFACE = 0x80004002,
}