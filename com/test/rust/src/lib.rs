mod _result;

use _result::IMy;
use nanocom::CObjectEx;

use crate::_result::IMy::ClassEx;

struct My {}

impl nanocom::Class for My {
    type Interface = _result::IMy::Interface;
    fn static_vmt() -> &'static _result::IMy::Vmt {
        static VMT: _result::IMy::Vmt = My::VMT;
        &VMT
    }
}

impl _result::IMy::Ex for nanocom::CObject<My> {
    fn GetSlice(&self) -> _result::Slice {
        todo!()
    }

    fn SetSlice(&self, slice: _result::Slice) {
        println!("SetSlice: {:?}, {:?}", slice.Start, slice.Size);
    }

    fn GetUnsafe(&self) -> *const bool {
        todo!()
    }

    fn SetUnsafe(&self, _p: *const _result::Slice, _size: u32) {
        todo!()
    }

    fn Some(&self, _p: &_result::IMy::Object) -> bool {
        todo!()
    }

    fn GetIMy(&self, _a: u16, _b: i16) -> _result::IMy::Ref {
        todo!()
    }

    fn SetManagedStruct(&self, _a: _result::ManagedStruct) {
        todo!()
    }
}

#[no_mangle]
pub extern "C" fn get() -> i32 {
    42
}

#[no_mangle]
pub extern "C" fn rust_my_create() -> IMy::Ref {
    My {}.to_cobject()
}
