use super::{Array, create::create};
use crate::vm::{Any, Function, IVm, Nullish, String, ToArray, Unpacked};

/// An element beside its `ToString`, the key the default order sorts by.
type Keyed<A> = (String<A>, Any<A>);

impl<A: IVm> Array<A> {
    /// `Array.prototype.toSorted(compare)`
    /// (<https://tc39.es/ecma262/#sec-array.prototype.tosorted>) over a
    /// comparator already checked: a new array of the elements in a stable
    /// order. `undefined` elements go last, in their order, and are never
    /// compared.
    ///
    /// With no comparator, elements compare by their `ToString` as UTF-16
    /// code units, so `[10, 9, 1]` sorts `[1, 10, 9]`; each element is
    /// converted once rather than once per comparison, which nothing pure
    /// can tell apart but for which of several throws surfaces. Fewer than
    /// two elements to sort are never compared, so they are not converted
    /// either: a lone element whose conversion throws is copied. With one, `a`
    /// goes after `b` when `ToNumber(compare(a, b))` is above zero, `NaN`
    /// counting as zero and a bigint answer throwing as `ToNumber` does.
    ///
    /// The algorithm is a stable merge sort, and a comparator's first throw
    /// is the result. For a comparator that is not consistent, ECMAScript
    /// leaves the order to the engine, and this is this engine's answer.
    pub(crate) fn to_sorted(&self, compare: Option<Function<A>>) -> Result<Array<A>, Any<A>> {
        let (defined, undefined): (Vec<Any<A>>, Vec<Any<A>>) =
            self.clone().into_iter().partition(|v| {
                !matches!(
                    Unpacked::from(v.clone()),
                    Unpacked::Nullish(Nullish::Undefined)
                )
            });
        let sorted = match compare {
            None if defined.len() < 2 => defined,
            None => {
                let keyed: Result<Vec<Keyed<A>>, Any<A>> = defined
                    .into_iter()
                    .map(|v| Ok((v.clone().to_string()?, v)))
                    .collect();
                merge_sort::<_, Any<A>>(keyed?, &|a, b| Ok(a.0 > b.0))?
                    .into_iter()
                    .map(|(_, v)| v)
                    .collect()
            }
            Some(f) => merge_sort::<_, Any<A>>(defined, &|a, b| {
                Ok(f64::from(f.call([a.clone(), b.clone()].to_array())?.to_number()?) > 0.0)
            })?,
        };
        let len = (sorted.len() + undefined.len()) as u64;
        create(len, sorted.into_iter().chain(undefined))
    }
}

/// A stable merge sort under a fallible `after`, which answers whether its
/// first argument goes after its second: the halves are merged taking the
/// right one's element only when the left one's goes after it, so equal
/// elements keep their order, and the first `Err` is the result.
fn merge_sort<T: Clone, E>(
    mut items: Vec<T>,
    after: &impl Fn(&T, &T) -> Result<bool, E>,
) -> Result<Vec<T>, E> {
    if items.len() <= 1 {
        return Ok(items);
    }
    let right = items.split_off(items.len() / 2);
    let (left, right) = (merge_sort(items, after)?, merge_sort(right, after)?);
    let mut merged = Vec::with_capacity(left.len() + right.len());
    let (mut i, mut j) = (0, 0);
    while i < left.len() && j < right.len() {
        if after(&left[i], &right[j])? {
            merged.push(right[j].clone());
            j += 1;
        } else {
            merged.push(left[i].clone());
            i += 1;
        }
    }
    merged.extend_from_slice(&left[i..]);
    merged.extend_from_slice(&right[j..]);
    Ok(merged)
}

#[cfg(test)]
mod tests {
    use super::merge_sort;

    #[test]
    fn stable() {
        let items = vec![(1, 'a'), (0, 'b'), (1, 'c'), (0, 'd')];
        let sorted = merge_sort::<_, ()>(items, &|a, b| Ok(a.0 > b.0)).unwrap();
        assert_eq!(sorted, vec![(0, 'b'), (0, 'd'), (1, 'a'), (1, 'c')]);
    }

    #[test]
    fn first_error_is_the_result() {
        let sorted = merge_sort(vec![2, 1, 3], &|a: &i32, b: &i32| {
            if *a == 3 || *b == 3 {
                Err(3)
            } else {
                Ok(a > b)
            }
        });
        assert_eq!(sorted, Err(3));
        assert_eq!(merge_sort::<i32, ()>(vec![], &|_, _| Ok(true)), Ok(vec![]));
    }
}
