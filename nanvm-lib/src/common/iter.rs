use core::iter::once;

use super::default::default;

pub enum Either<L, R> {
    Left(L),
    Right(R),
}

impl<L, R, T> Iterator for Either<L, R>
where
    L: Iterator<Item = T>,
    R: Iterator<Item = T>,
{
    type Item = T;
    fn next(&mut self) -> Option<T> {
        match self {
            Either::Left(l) => l.next(),
            Either::Right(r) => r.next(),
        }
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        match self {
            Either::Left(l) => l.size_hint(),
            Either::Right(r) => r.size_hint(),
        }
    }
}

pub trait Iter: Sized + Iterator {
    //
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

    fn eq_by_<J: Iterator, F: FnMut(&Self::Item, &J::Item) -> bool>(
        mut self,
        mut j: J,
        mut cmp: F,
    ) -> bool {
        loop {
            match (self.next(), j.next()) {
                (Some(x), Some(y)) if cmp(&x, &y) => continue,
                (None, None) => return true,
                _ => return false,
            }
        }
    }
}

impl<T: Sized + Iterator> Iter for T {}
