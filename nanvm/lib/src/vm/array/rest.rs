use super::Array;
use crate::{
    common::sized_index::SizedIndex,
    vm::{IVm, ToArray},
};

impl<A: IVm> Array<A> {
    /// The arguments from the `i`-th on, as a rest parameter of a call
    /// whose arguments this array holds reads them: the array itself for
    /// `i == 0`, since nothing is skipped, and a new array of the items
    /// from `i` otherwise — empty when `i` is past the end.
    pub fn rest(&self, i: u32) -> Array<A> {
        if i == 0 {
            return self.clone();
        }
        (i..self.length().max(i))
            .map(|k| self[k].clone())
            .to_array()
    }
}

#[cfg(test)]
mod tests {
    use super::Array;
    use crate::{
        naive::Naive,
        vm::{Any, ToAny, ToArray},
    };

    type A = Naive;

    /// From `0`, the arguments themselves, the one array; from `i`, a new
    /// array of the items from `i`; from the end or past it, no items.
    #[test]
    fn rest() {
        let args = [1.0.to_any(), 2.0.to_any(), "s".into()].to_array();
        let items = |a: Array<A>| a.into_iter().collect::<Vec<_>>();
        assert_eq!(args.rest(0), args);
        assert_ne!(args.rest(1), args);
        assert_eq!(items(args.rest(1)), vec![2.0.to_any(), "s".into()]);
        assert_eq!(items(args.rest(2)), vec!["s".into()]);
        assert_eq!(items(args.rest(3)), vec![]);
        assert_eq!(items(args.rest(9)), vec![]);
        assert_eq!(items(Array::<A>::default().rest(0)), vec![]);
        let _: Any<A> = args.rest(1).to_any();
    }
}
