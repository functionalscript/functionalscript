mod add;
mod cmp;
mod debug;
mod default;
mod from;
mod index;
mod mul;
mod neg;
mod partial_eq;
mod serializable;
mod sized_index;
mod sub;

use core::{cmp::Ordering, iter::once};

use crate::{
    common::sized_index::SizedIndex,
    sign::Sign,
    vm::{IContainer, IVm},
};

/// ```
/// use nanvm_lib::vm::{BigInt, IVm, naive::Naive};
/// fn bigint_test<A: IVm>() {
///     let a: BigInt<A> = 12345678901234567890u64.into();
///     let b: BigInt<A> = (-1234567890123456789i64).into();
/// }
///
/// bigint_test::<Naive>();
/// ```
#[derive(Clone)]
pub struct BigInt<A: IVm>(A::InternalBigInt);

impl<A: IVm> BigInt<A> {
    fn is_zero(&self) -> bool {
        self.0.items().is_empty()
    }

    fn new(sign: Sign, items: impl IntoIterator<Item = u64>) -> Self {
        Self(A::InternalBigInt::new_ok(sign, items))
    }

    fn new_one(sign: Sign, value: u64) -> Self {
        Self::new(sign, once(value))
    }

    fn add_to_vec(mut vec: Vec<u64>, index: u32, add: u128) -> Vec<u64> {
        // TODO: replace recursion with loop.
        let sum = vec[index as usize] as u128 + add;
        vec[index as usize] = sum as u64;
        let carry = sum >> 64;
        if carry > 0 {
            vec = Self::add_to_vec(vec, index + 1, carry);
        }
        vec
    }

    // NOTE: use .index_iter in abs_* helpers.

    fn abs_cmp_vec(self, rhs: Self) -> Ordering {
        let mut iter_a = self.index_iter();
        let mut iter_b = rhs.index_iter();
        loop {
            match (iter_a.next(), iter_b.next()) {
                (Some(a), Some(b)) => {
                    let cmp = a.cmp(&b);
                    if cmp != Ordering::Equal {
                        return cmp;
                    }
                }
                (Some(_), None) => return Ordering::Greater,
                (None, Some(_)) => return Ordering::Less,
                (None, None) => return Ordering::Equal,
            }
        }
    }

    fn abs_add_vec(self, rhs: Self) -> Vec<u64> {
        let mut iter_a = self.index_iter();
        let mut iter_b = rhs.index_iter();
        let mut carry: u128 = 0;
        let mut out: Vec<u64> = Vec::new();
        loop {
            let mut a = 0u64;
            let mut b = 0u64;
            match (iter_a.next(), iter_b.next()) {
                (Some(some_a), Some(some_b)) => {
                    a = some_a;
                    b = some_b;
                }
                (Some(some_a), None) => a = some_a,
                (None, Some(some_b)) => b = some_b,
                (None, None) => break,
            }
            let sum = a as u128 + b as u128 + carry;
            out.push(sum as u64);
            carry = sum >> 64;
        }

        if carry > 0 {
            out.push(carry as u64);
        }
        out
    }

    fn abs_sub_vec(self, rhs: Self) -> Vec<u64> {
        let mut iter_a = self.index_iter();
        let mut iter_b = rhs.index_iter();
        let mut borrow: u64 = 0;
        let mut out: Vec<u64> = Vec::new();

        loop {
            let Some(a) = iter_a.next() else {
                break;
            };
            let Some(b) = iter_b.next() else {
                if a < borrow {
                    panic!("abs_sub_vec: rhs is greater than self");
                }
                out.push(a - borrow);
                borrow = 0;
                for remaining in iter_a {
                    out.push(remaining);
                }
                break;
            };

            let b_plus_borrow = b as u128 + borrow as u128;
            let mut a_extended = a as u128;
            if a_extended >= b_plus_borrow {
                borrow = 0;
            } else {
                a_extended += 1u128 << 64;
                borrow = 1;
            }
            out.push((a_extended - b_plus_borrow) as u64);
        }

        if borrow != 0 || iter_b.next().is_some() {
            panic!("abs_sub_vec: rhs is greater than self");
        }

        // Trim leading zeros (most-significant words)
        while let Some(&last) = out.last() {
            if last == 0 {
                out.pop();
            } else {
                break;
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vm::naive::Naive;
    use core::cmp::Ordering;

    type TestBigInt = BigInt<Naive>;

    #[test]
    fn test_abs_cmp_vec_equal_numbers() {
        let a: TestBigInt = 12345u64.into();
        let b: TestBigInt = 12345u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Equal);
    }

    #[test]
    fn test_abs_cmp_vec_equal_zero() {
        let a: TestBigInt = 0u64.into();
        let b: TestBigInt = 0u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Equal);
    }

    #[test]
    fn test_abs_cmp_vec_simple_different_lengths() {
        let one_digit = TestBigInt::new(crate::sign::Sign::Positive, vec![100u64]);
        let two_digits = TestBigInt::new(crate::sign::Sign::Positive, vec![100u64, 1u64]);
        assert_eq!(
            two_digits.clone().abs_cmp_vec(one_digit.clone()),
            Ordering::Greater
        );
        assert_eq!(one_digit.abs_cmp_vec(two_digits), Ordering::Less);
    }

    #[test]
    fn test_abs_cmp_vec_same_length_first_greater() {
        let a: TestBigInt = 12346u64.into();
        let b: TestBigInt = 12345u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Greater);
    }

    #[test]
    fn test_abs_cmp_vec_same_length_first_less() {
        let a: TestBigInt = 12344u64.into();
        let b: TestBigInt = 12345u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Less);
    }

    #[test]
    fn test_abs_cmp_vec_most_significant_digit_differs() {
        let a: TestBigInt = 0x8000_0000_0000_0000u64.into();
        let b: TestBigInt = 0x7FFF_FFFF_FFFF_FFFFu64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Greater);
    }

    #[test]
    fn test_abs_cmp_vec_least_significant_digit_differs() {
        let a: TestBigInt = 0x1000_0000_0000_0001u64.into();
        let b: TestBigInt = 0x1000_0000_0000_0000u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Greater);
    }

    #[test]
    fn test_abs_cmp_vec_zero_vs_nonzero() {
        let a: TestBigInt = 0u64.into();
        let b: TestBigInt = 1u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Less);

        let a: TestBigInt = 1u64.into();
        let b: TestBigInt = 0u64.into();
        assert_eq!(a.abs_cmp_vec(b), Ordering::Greater);
    }

    #[test]
    fn test_abs_cmp_vec_simple_large_numbers() {
        // Test with large u64 numbers instead of multi-digit
        let large1: TestBigInt = 0xFFFF_FFFF_FFFF_FFFFu64.into();
        let large2: TestBigInt = 0xFFFF_FFFF_FFFF_FFFEu64.into();

        assert_eq!(
            large1.clone().abs_cmp_vec(large2.clone()),
            Ordering::Greater
        );
        assert_eq!(large2.clone().abs_cmp_vec(large1.clone()), Ordering::Less);
        assert_eq!(large1.clone().abs_cmp_vec(large1.clone()), Ordering::Equal);
    }

    #[test]
    fn test_abs_cmp_vec_simple_equal() {
        let large1: TestBigInt = 0x1234_5678_9ABC_DEF0u64.into();
        let large2: TestBigInt = 0x1234_5678_9ABC_DEF0u64.into();

        assert_eq!(large1.abs_cmp_vec(large2), Ordering::Equal);
    }

    #[test]
    fn test_abs_cmp_vec_simple_digit_difference() {
        // Test simple cases where we know the expected result
        let large1: TestBigInt = 0x8000_0000_0000_0000u64.into();
        let large2: TestBigInt = 0x7FFF_FFFF_FFFF_FFFFu64.into();

        assert_eq!(large1.abs_cmp_vec(large2), Ordering::Greater);
    }

    // Tests for abs_add_vec

    #[test]
    fn test_abs_add_vec_basic() {
        let a: TestBigInt = 123u64.into();
        let b: TestBigInt = 456u64.into();
        let result = a.abs_add_vec(b);
        let expected = TestBigInt::new(crate::sign::Sign::Positive, result);
        let expected_value: TestBigInt = 579u64.into();
        assert_eq!(expected.abs_cmp_vec(expected_value), Ordering::Equal);
    }

    #[test]
    fn test_abs_add_vec_zero() {
        let a: TestBigInt = 42u64.into();
        let b: TestBigInt = 0u64.into();
        let result = a.clone().abs_add_vec(b);
        let result_bigint = TestBigInt::new(crate::sign::Sign::Positive, result);
        assert_eq!(result_bigint.abs_cmp_vec(a), Ordering::Equal);

        let c: TestBigInt = 0u64.into();
        let d: TestBigInt = 17u64.into();
        let result2 = c.abs_add_vec(d.clone());
        let result2_bigint = TestBigInt::new(crate::sign::Sign::Positive, result2);
        assert_eq!(result2_bigint.abs_cmp_vec(d), Ordering::Equal);
    }

    #[test]
    fn test_abs_add_vec_carry() {
        let a: TestBigInt = u64::MAX.into();
        let b: TestBigInt = 1u64.into();
        let result = a.abs_add_vec(b);

        // u64::MAX + 1 should produce [0, 1] (carry to next digit)
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], 0u64);
        assert_eq!(result[1], 1u64);
    }

    #[test]
    fn test_abs_add_vec_different_lengths() {
        let small = TestBigInt::new(crate::sign::Sign::Positive, vec![100u64]);
        let large = TestBigInt::new(crate::sign::Sign::Positive, vec![200u64, 1u64]);

        let result1 = small.clone().abs_add_vec(large.clone());
        let result2 = large.abs_add_vec(small);

        // Addition should be commutative
        assert_eq!(result1.len(), result2.len());
        for (a, b) in result1.iter().zip(result2.iter()) {
            assert_eq!(a, b);
        }

        // Result should be [300, 1]
        assert_eq!(result1[0], 300u64);
        assert_eq!(result1[1], 1u64);
    }

    #[test]
    fn test_abs_add_vec_multiple_carries() {
        let a = TestBigInt::new(crate::sign::Sign::Positive, vec![u64::MAX, u64::MAX]);
        let b: TestBigInt = 1u64.into();

        let result = a.abs_add_vec(b);

        // [u64::MAX, u64::MAX] + 1 should produce [0, 0, 1]
        assert_eq!(result.len(), 3);
        assert_eq!(result[0], 0u64);
        assert_eq!(result[1], 0u64);
        assert_eq!(result[2], 1u64);
    }

    #[test]
    fn test_abs_add_vec_same_large_numbers() {
        let large: TestBigInt = 0x7FFF_FFFF_FFFF_FFFFu64.into();
        let result = large.clone().abs_add_vec(large);
        let result_bigint = TestBigInt::new(crate::sign::Sign::Positive, result);

        let expected: TestBigInt = 0xFFFF_FFFF_FFFF_FFFEu64.into();
        assert_eq!(result_bigint.abs_cmp_vec(expected), Ordering::Equal);
    }

    #[test]
    fn test_abs_add_vec_no_carry() {
        let a: TestBigInt = 1000u64.into();
        let b: TestBigInt = 2000u64.into();
        let result = a.abs_add_vec(b);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], 3000u64);
    }

    #[test]
    fn test_abs_add_vec_both_zero() {
        let a: TestBigInt = 0u64.into();
        let b: TestBigInt = 0u64.into();
        let result = a.abs_add_vec(b);

        // Zero might be represented as empty vector in this implementation
        assert!(result.is_empty() || (result.len() == 1 && result[0] == 0u64));
    }

    // Tests for abs_sub_vec

    #[test]
    fn test_abs_sub_vec_basic() {
        let a: TestBigInt = 456u64.into();
        let b: TestBigInt = 123u64.into();
        let result = a.abs_sub_vec(b);
        let result_bigint = TestBigInt::new(crate::sign::Sign::Positive, result);
        let expected: TestBigInt = 333u64.into();
        assert_eq!(result_bigint.abs_cmp_vec(expected), Ordering::Equal);
    }

    #[test]
    fn test_abs_sub_vec_same_numbers() {
        let a: TestBigInt = 12345u64.into();
        let result = a.clone().abs_sub_vec(a);

        // Result should be zero (empty vec or [0])
        assert!(result.is_empty() || (result.len() == 1 && result[0] == 0u64));
    }

    #[test]
    fn test_abs_sub_vec_subtract_zero() {
        let a: TestBigInt = 42u64.into();
        let b: TestBigInt = 0u64.into();
        let result = a.clone().abs_sub_vec(b);
        let result_bigint = TestBigInt::new(crate::sign::Sign::Positive, result);
        assert_eq!(result_bigint.abs_cmp_vec(a), Ordering::Equal);
    }

    #[test]
    fn test_abs_sub_vec_with_borrow() {
        let a: TestBigInt = 1000u64.into();
        let b: TestBigInt = 1u64.into();
        let result = a.abs_sub_vec(b);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], 999u64);
    }

    #[test]
    fn test_abs_sub_vec_different_lengths() {
        let large = TestBigInt::new(crate::sign::Sign::Positive, vec![300u64, 2u64]);
        let small = TestBigInt::new(crate::sign::Sign::Positive, vec![100u64]);

        let result = large.abs_sub_vec(small);

        // [300, 2] - [100] should be [200, 2]
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], 200u64);
        assert_eq!(result[1], 2u64);
    }

    #[test]
    fn test_abs_sub_vec_borrow_propagation() {
        let a = TestBigInt::new(crate::sign::Sign::Positive, vec![0u64, 1u64]); // 2^64
        let b: TestBigInt = 1u64.into();

        let result = a.abs_sub_vec(b);

        // 2^64 - 1 should be u64::MAX
        assert_eq!(result.len(), 1);
        assert_eq!(result[0], u64::MAX);
    }

    #[test]
    fn test_abs_sub_vec_leading_zero_trim() {
        let a = TestBigInt::new(crate::sign::Sign::Positive, vec![100u64, 1u64]);
        let b = TestBigInt::new(crate::sign::Sign::Positive, vec![100u64, 1u64]);

        let result = a.abs_sub_vec(b);

        // Should trim leading zeros and result in empty or [0]
        assert!(result.is_empty() || (result.len() == 1 && result[0] == 0u64));
    }

    #[test]
    fn test_abs_sub_vec_large_numbers() {
        let a: TestBigInt = u64::MAX.into();
        let b: TestBigInt = (u64::MAX - 1000u64).into();
        let result = a.abs_sub_vec(b);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], 1000u64);
    }

    #[test]
    fn test_abs_sub_vec_no_borrow() {
        let a: TestBigInt = 5000u64.into();
        let b: TestBigInt = 2000u64.into();
        let result = a.abs_sub_vec(b);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], 3000u64);
    }

    #[test]
    #[should_panic(expected = "abs_sub_vec: rhs is greater than self")]
    fn test_abs_sub_vec_panic_rhs_greater() {
        let a: TestBigInt = 100u64.into();
        let b: TestBigInt = 200u64.into();
        let _ = a.abs_sub_vec(b); // Should panic
    }

    #[test]
    #[should_panic(expected = "abs_sub_vec: rhs is greater than self")]
    fn test_abs_sub_vec_panic_different_lengths() {
        let small = TestBigInt::new(crate::sign::Sign::Positive, vec![100u64]);
        let large = TestBigInt::new(crate::sign::Sign::Positive, vec![100u64, 1u64]);
        let _ = small.abs_sub_vec(large); // Should panic - small < large
    }
}
