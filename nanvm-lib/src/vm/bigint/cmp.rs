use crate::vm::{IContainer, IVm, bigint::BigInt};
use std::cmp::Ordering;

impl<A: IVm> PartialOrd for BigInt<A> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl<A: IVm> Ord for BigInt<A> {
    fn cmp(&self, rhs: &Self) -> Ordering {
        use crate::sign::Sign;

        let lhs_sign = *self.0.header();
        let rhs_sign = *rhs.0.header();

        match (lhs_sign, rhs_sign) {
            (Sign::Positive, Sign::Negative) => Ordering::Greater,
            (Sign::Negative, Sign::Positive) => Ordering::Less,
            (Sign::Positive, Sign::Positive) => self.clone().abs_cmp_vec(rhs.clone()),
            (Sign::Negative, Sign::Negative) => rhs.clone().abs_cmp_vec(self.clone()),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::{naive::Naive, vm::bigint::BigInt};
    use std::cmp::Ordering;

    type TestBigInt = BigInt<Naive>;

    #[test]
    fn cmp_positive_vs_negative() {
        let lhs: TestBigInt = 1u64.into();
        let rhs: TestBigInt = (-1i64).into();
        assert_eq!(lhs.cmp(&rhs), Ordering::Greater);
        assert_eq!(rhs.cmp(&lhs), Ordering::Less);
    }

    #[test]
    fn cmp_positive_by_absolute_value() {
        let lhs: TestBigInt = 5u64.into();
        let rhs: TestBigInt = 6u64.into();
        assert_eq!(lhs.cmp(&rhs), Ordering::Less);
        assert_eq!(rhs.cmp(&lhs), Ordering::Greater);
    }

    #[test]
    fn cmp_negative_reverses_absolute_order() {
        let lhs: TestBigInt = (-5i64).into();
        let rhs: TestBigInt = (-6i64).into();
        assert_eq!(lhs.cmp(&rhs), Ordering::Greater);
        assert_eq!(rhs.cmp(&lhs), Ordering::Less);
    }

    #[test]
    fn cmp_equal_values() {
        let lhs: TestBigInt = 0u64.into();
        let rhs: TestBigInt = 0u64.into();
        assert_eq!(lhs.cmp(&rhs), Ordering::Equal);
    }
}
