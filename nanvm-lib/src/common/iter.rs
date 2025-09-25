use crate::common::default::default;

pub trait Iter: Sized + Iterator {
    fn reduce_or_default<I, E>(mut self, o: impl Fn(I, I) -> I) -> Result<I, E>
    where
        Self: Iterator<Item = Result<I, E>>,
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
    fn intersperse(self, sep: Self::Item) -> impl Iterator<Item = Self::Item>
    where
        Self::Item: Clone,
    {
        self.flat_map(move |x| [sep.clone(), x])
            .skip(1)
    }
}

impl<T: Sized + Iterator> Iter for T {}
