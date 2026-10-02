use core::iter::{from_fn, once};

use crate::common::either::Either;

pub trait Iter: Sized + Iterator {
    /// See https://doc.rust-lang.org/std/iter/struct.Intersperse.html
    fn intersperse_(self, sep: Self::Item) -> impl Iterator<Item = Self::Item>
    where
        Self::Item: Clone,
    {
        self.flat_map(move |x| [sep.clone(), x]).skip(1)
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

    /// Walks `self` and `j` together to the end of the longer one: each item
    /// is a pair with at least one side present, and the shorter side is
    /// `None` past its end.
    fn zip_longest<J: IntoIterator>(
        self,
        j: J,
    ) -> impl Iterator<Item = (Option<Self::Item>, Option<J::Item>)> {
        let mut i = self.fuse();
        let mut j = j.into_iter().fuse();
        from_fn(move || match (i.next(), j.next()) {
            (None, None) => None,
            pair => Some(pair),
        })
    }

    /// See https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.eq_by
    fn eq_by_<J: Iterator>(self, j: J, mut cmp: impl FnMut(&Self::Item, &J::Item) -> bool) -> bool {
        self.zip_longest(j).all(|pair| match pair {
            (Some(x), Some(y)) => cmp(&x, &y),
            _ => false,
        })
    }
}

impl<T: Sized + Iterator> Iter for T {}

#[cfg(test)]
mod test {
    use super::Iter;

    #[test]
    fn zip_longest_same_length() {
        let pairs: Vec<_> = [1, 2].into_iter().zip_longest(['a', 'b']).collect();
        assert_eq!(pairs, [(Some(1), Some('a')), (Some(2), Some('b'))]);
    }

    #[test]
    fn zip_longest_left_longer() {
        let pairs: Vec<_> = [1, 2].into_iter().zip_longest(['a']).collect();
        assert_eq!(pairs, [(Some(1), Some('a')), (Some(2), None)]);
    }

    #[test]
    fn zip_longest_right_longer() {
        let pairs: Vec<_> = [1].into_iter().zip_longest(['a', 'b']).collect();
        assert_eq!(pairs, [(Some(1), Some('a')), (None, Some('b'))]);
    }

    #[test]
    fn zip_longest_empty() {
        let pairs: Vec<_> = [0; 0].into_iter().zip_longest(['a'; 0]).collect();
        assert_eq!(pairs, []);
    }

    #[test]
    fn eq_by_() {
        let eq = |a: &i32, b: &i32| a == b;
        assert!([1, 2].into_iter().eq_by_([1, 2].into_iter(), eq));
        assert!(![1, 2].into_iter().eq_by_([1, 3].into_iter(), eq));
        assert!(![1, 2].into_iter().eq_by_([1].into_iter(), eq));
        assert!(![1].into_iter().eq_by_([1, 2].into_iter(), eq));
        assert!([].into_iter().eq_by_([].into_iter(), eq));
    }
}
