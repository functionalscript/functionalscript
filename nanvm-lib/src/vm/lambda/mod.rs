use core::{marker::PhantomData, todo};

use crate::vm::{Any, IVm};

pub trait End<A: IVm>: Sized {
    fn end(self) -> Result<Any<A>, Any<A>> {
        todo!()
    }
}

pub trait OptionCall<A: IVm>: End<A> {
    /// `?.()`
    fn option_call(self, _: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionLambda<A> {
        todo!()
    }
}

pub struct PropertyLambda<A: IVm>(PhantomData<A>);

impl<A: IVm> End<A> for PropertyLambda<A> {}

impl<A: IVm> OptionCall<A> for PropertyLambda<A> {}

impl<A: IVm> PropertyLambda<A> {
    /// `()`
    pub fn end_call(self, _: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Result<Any<A>, Any<A>> {
        todo!()
    }
}

pub trait Continuation<A: IVm>: End<A> {
    // `()`
    fn call(self, _: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionLambda<A> {
        todo!()
    }
    // `.`
    fn dot(self, _: impl FnOnce() -> Result<Any<A>, Any<A>>) -> OptionPropertyLambda<A> {
        todo!()
    }
}

pub struct OptionLambda<A: IVm>(PhantomData<A>);

impl<A: IVm> End<A> for OptionLambda<A> {}

impl<A: IVm> Continuation<A> for OptionLambda<A> {}

pub struct OptionPropertyLambda<A: IVm>(PhantomData<A>);

impl<A: IVm> End<A> for OptionPropertyLambda<A> {}

impl<A: IVm> Continuation<A> for OptionPropertyLambda<A> {}

impl<A: IVm> OptionCall<A> for OptionPropertyLambda<A> {}

impl<A: IVm> OptionPropertyLambda<A> {
    // `!()`
    pub fn end_call(self, _: impl FnOnce() -> Result<Any<A>, Any<A>>) -> Result<Any<A>, Any<A>> {
        todo!()
    }
}
