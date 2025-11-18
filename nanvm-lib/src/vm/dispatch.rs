use crate::{
    nullish::Nullish,
    vm::{Array, BigInt, Function, IVm, Object, String},
};

pub trait Dispatch<A: IVm>: Sized {
    type Result;
    fn nullish(self, v: Nullish) -> Self::Result;
    fn bool(self, v: bool) -> Self::Result;
    fn number(self, v: f64) -> Self::Result;
    fn string(self, v: String<A>) -> Self::Result;
    fn bigint(self, v: BigInt<A>) -> Self::Result;
    fn object(self, v: Object<A>) -> Self::Result;
    fn array(self, v: Array<A>) -> Self::Result;
    fn function(self, v: Function<A>) -> Self::Result;
}
