use std::iter::once;

use crate::common::default::default;

pub trait Iter<I, E>: Sized + Iterator<Item = Result<I, E>> {
    fn reduce_or_default(mut self, o: impl Fn(I, I) -> I) -> Result<I, E>
    where
        I: Default,
    {
        let mut res = match self.next() {
            None => return Ok(default()),
            Some(res) => res?,
        };
        for v in self {
            res = o(res, v?)
        }
        Ok(res)
    }
    fn intersperse(mut self, sep: I) -> impl Iterator<Item = Result<I, E>>
    where
        I: Clone,
    {
        // Take the first element separately so we can avoid prefixing with sep
        let first = self.next();

        first
            .into_iter()
            .chain(self.flat_map(move |x| once(Ok(sep.clone())).chain(once(x))))
    }
}

impl<I, E, T: Sized + Iterator<Item = Result<I, E>>> Iter<I, E> for T {}
