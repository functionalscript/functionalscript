use crate::vm::{IVm, bigint::BigInt};
use std::cmp::Ordering;

impl<A: IVm> PartialOrd for BigInt<A> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// The single owner of how two `BigInt`s relate: [`PartialEq`] (in
/// `partial_eq.rs`) and [`PartialOrd`] both delegate here.
///
/// Invariant: both operands are normalized — no leading (most-significant)
/// zero words, and zero is always `Sign::Positive` with no words (no negative
/// zero). That is what makes the sign order sound (a negative value is always
/// below a positive one) and what `abs_cmp_vec` asserts; a non-normalized
/// operand panics.
impl<A: IVm> Ord for BigInt<A> {
    fn cmp(&self, rhs: &Self) -> Ordering {
        use crate::sign::Sign;

        let sign = self.sign();
        sign.cmp(&rhs.sign()).then_with(|| match sign {
            Sign::Positive => self.clone().abs_cmp_vec(rhs.clone()),
            Sign::Negative => rhs.clone().abs_cmp_vec(self.clone()),
        })
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::bigint::test_util::{T, int, neg, pos};
    use std::cmp::Ordering;

    #[test]
    fn cmp_positive_vs_negative() {
        let lhs: T = 1u64.into();
        let rhs: T = (-1i64).into();
        assert_eq!(lhs.cmp(&rhs), Ordering::Greater);
        assert_eq!(rhs.cmp(&lhs), Ordering::Less);
    }

    #[test]
    fn cmp_positive_by_absolute_value() {
        let lhs: T = 5u64.into();
        let rhs: T = 6u64.into();
        assert_eq!(lhs.cmp(&rhs), Ordering::Less);
        assert_eq!(rhs.cmp(&lhs), Ordering::Greater);
    }

    #[test]
    fn cmp_negative_reverses_absolute_order() {
        let lhs: T = (-5i64).into();
        let rhs: T = (-6i64).into();
        assert_eq!(lhs.cmp(&rhs), Ordering::Greater);
        assert_eq!(rhs.cmp(&lhs), Ordering::Less);
    }

    #[test]
    fn cmp_equal_values() {
        let lhs: T = 0u64.into();
        let rhs: T = 0u64.into();
        assert_eq!(lhs.cmp(&rhs), Ordering::Equal);
    }

    /// Values covering the sign/zero cases: zero, ±1, single- and multiword
    /// magnitudes of both signs, and pairs of equal magnitude with opposite
    /// signs. Called twice so equal values come from distinct allocations.
    fn cases() -> [T; 9] {
        [
            int(0),
            int(1),
            int(-1),
            int(5),
            int(-5),
            pos([0, 1]),
            neg([0, 1]),
            pos([7, 1]),
            neg([7, 1]),
        ]
    }

    #[test]
    fn eq_agrees_with_cmp() {
        for (i, a) in cases().iter().enumerate() {
            for (j, b) in cases().iter().enumerate() {
                assert_eq!(a == b, a.cmp(b) == Ordering::Equal, "{a:?} vs {b:?}");
                assert_eq!(a == b, i == j, "{a:?} vs {b:?}");
                assert_eq!(a.partial_cmp(b), Some(a.cmp(b)), "{a:?} vs {b:?}");
                assert_eq!(a.cmp(b), b.cmp(a).reverse(), "{a:?} vs {b:?}");
            }
        }
        // Negating zero yields zero, not a negative zero.
        let negated_zero = -int(0);
        assert_eq!(negated_zero.cmp(&int(0)), Ordering::Equal);
        assert!(negated_zero == int(0));
    }
}
