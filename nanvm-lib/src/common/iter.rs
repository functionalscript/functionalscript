use core::iter::once;

use crate::common::either::Either;

use super::default::default;

pub trait Iter: Sized + Iterator {
    /// See https://doc.rust-lang.org/std/iter/struct.Intersperse.html
    fn intersperse_(self, sep: Self::Item) -> impl Iterator<Item = Self::Item>
    where
        Self::Item: Clone,
    {
        self.flat_map(move |x| [sep.clone(), x]).skip(1)
    }

    //
    fn try_reduce<I, E>(mut self, o: impl Fn(I, I) -> I) -> Result<I, E>
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

    //
    fn try_flatten<I: IntoIterator, E>(self) -> impl Iterator<Item = Result<I::Item, E>>
    where
        Self: Iterator<Item = Result<I, E>>,
    {
        self.flat_map(|v| match v {
            Err(e) => Either::Left(once(Err(e))),
            Ok(i) => Either::Right(i.into_iter().map(Result::Ok)),
        })
    }

    /// See https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.eq_by
    fn eq_by_<J: Iterator>(
        mut self,
        mut j: J,
        mut cmp: impl FnMut(&Self::Item, &J::Item) -> bool,
    ) -> bool {
        loop {
            match (self.next(), j.next()) {
                (Some(x), Some(y)) => {
                    if !cmp(&x, &y) {
                        return false;
                    }
                }
                (None, None) => return true,
                _ => return false,
            }
        }
    }
}

impl<T: Sized + Iterator> Iter for T {}
