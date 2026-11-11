use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm},
};

impl<A: IVm> Array<A> {
    /// The `i`-th argument of a call whose arguments this array holds, or
    /// `undefined` past the end, as JavaScript binds a parameter the call
    /// left out. What a built-in and a compiled function's body read their
    /// fixed arguments with: one bounds check and one clone, where
    /// `Index<u32>` panics past the end.
    pub fn argument(&self, i: u32) -> Any<A> {
        self.present(i).unwrap_or_else(Any::undefined)
    }

    /// The `i`-th argument if the call passed one, `undefined` included,
    /// and `None` if it did not: for a reader whose answer depends on
    /// whether an argument is there, not only on its value —
    /// `lastIndexOf(x)` searches from the end, `lastIndexOf(x, undefined)`
    /// from `0`, and an effect's optional parameter is absent.
    pub fn present(&self, i: u32) -> Option<Any<A>> {
        self.get(i).cloned()
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, ToAny, ToArray},
    };

    type A = Naive;

    /// An argument the call passed is itself, `undefined` included; one
    /// past the end is `undefined`.
    #[test]
    fn argument() {
        let args = [1.0.to_any(), Any::<A>::undefined(), "s".into()].to_array();
        assert_eq!(args.argument(0), 1.0.to_any());
        assert_eq!(args.argument(1), Any::undefined());
        assert_eq!(args.argument(2), "s".into());
        assert_eq!(args.argument(3), Any::undefined());
        assert_eq!(args.argument(u32::MAX), Any::undefined());
        assert_eq!([].to_array().argument(0), Any::<A>::undefined());
    }

    /// An argument the call passed is there, `undefined` included; one
    /// past the end is not.
    #[test]
    fn present() {
        let args = [1.0.to_any(), Any::<A>::undefined()].to_array();
        assert_eq!(args.present(0), Some(1.0.to_any()));
        assert_eq!(args.present(1), Some(Any::undefined()));
        assert_eq!(args.present(2), None);
        assert_eq!([].to_array().present(0), None::<Any<A>>);
    }
}
