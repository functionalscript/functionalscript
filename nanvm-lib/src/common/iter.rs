use crate::common::default::default;

pub trait Iter<I, E>: Sized + Iterator<Item = Result<I, E>> {
    fn reduce_or_default(mut self, o: impl Fn(I, I) -> I) -> Result<I, E>
    where
        I: Default,
    {
        let mut i = match self.next() {
            None => return Ok(default()),
            Some(res) => res?,
        };
        for v in self {
            i = o(i, v?)
        }
        Ok(i)
    }
    fn intersperse(self, sep: I) -> impl Iterator<Item = Result<I, E>>
    where
        I: Clone,
    {
        self.flat_map(move |x| [Ok(sep.clone()), x])
            .skip(1)
    }
}

impl<I, E, T: Sized + Iterator<Item = Result<I, E>>> Iter<I, E> for T {}
