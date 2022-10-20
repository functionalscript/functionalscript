use crate::_result::IMy::ClassEx;

mod _result;

struct My {}

impl nanocom::Class for My {
    type Interface = _result::IMy::Interface;
    fn static_vmt() -> &'static _result::IMy::Vmt {
        static vmt: _result::IMy::Vmt = _result::IMy::Vmt {
            iunknown: My::IUNKNOWN,
            interface: My::INTERFACE,
        };
        &vmt
    }
}

impl _result::IMy::Ex for nanocom::CObject<My> {
    fn GetSlice(&self) -> _result::Slice {
        todo!()
    }

    fn SetSlice(&self, slice: _result::Slice) {
        todo!()
    }

    fn GetUnsafe(&self) -> *const bool {
        todo!()
    }

    fn SetUnsafe(&self, p: *const _result::Slice, size: u32) {
        todo!()
    }

    fn Some(&self, p: &_result::IMy::Object) -> bool {
        todo!()
    }

    fn GetIMy(&self) -> _result::IMy::Ref {
        todo!()
    }

    fn SetManagedStruct(&self, a: _result::ManagedStruct) {
        todo!()
    }
}