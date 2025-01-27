use std::iter;

use super::interface::Container;

pub trait BigUint<Sign: Default>: Container<Header = Sign, Item = u64> {
    fn zero() -> Self {
        Self::new(Sign::default(), iter::empty::<u64>())
    }

    fn is_zero(&self) -> bool {
        self.items_len() == 0
    }

    fn normalize_unsigned(&mut self) {
        let mut len = self.items_len();
        while len > 0 && self.item(len - 1) == 0 {
            self.pop_last_item();
            len -= 1;
        }
    }

    fn add_to_item(&mut self, index: usize, add: u128) {
        let sum = self.item(index) as u128 + add;
        self.set_item(index, sum as u64);
        let carry = sum >> 64;
        if carry > 0 {
            self.add_to_item(index + 1, carry);
        }
    }

    fn multiply_unsigned(&self, other: Self) -> Self {
        if self.is_zero() || other.is_zero() {
            return Self::zero();
        }

        let lhs_max = self.items_len() - 1;
        let rhs_max = other.items_len() - 1;
        let total_max = self.items_len() + other.items_len() - 1;
        let mut result = Self::new_sized(Sign::default(), total_max + 1);
        let mut i: usize = 0;
        while i < total_max {
            let mut j = i.saturating_sub(rhs_max);
            let max = if i < lhs_max { i } else { lhs_max };
            while j <= max {
                result.add_to_item(i, self.item(j) as u128 * other.item(i - j) as u128);
                j += 1;
            }
            i += 1;
        }

        result.normalize_unsigned();
        result
    }
}
