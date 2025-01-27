use super::interface::Container;

pub trait BigUint<Sign: Default>: Container<Header = Sign, Item = u64> {
    fn zero() -> Self {
        Self::new_sized(Sign::default(), 0)
    }

    fn is_zero(&self) -> bool {
        self.items().len() == 0
    }

    fn normalize(&mut self) {
        let mut len = self.items().len();
        while len > 0 && self.items()[len - 1] == 0 {
            self.pop_last_item();
            len -= 1;
        }
    }

    fn add_to_item(&mut self, index: usize, add: u128) {
        let sum = self.items()[index] as u128 + add;
        self.set_item(index, sum as u64);
        let carry = sum >> 64;
        if carry > 0 {
            self.add_to_item(index + 1, carry);
        }
    }

    fn multiply(&self, other: Self) -> Self {
        if self.is_zero() || other.is_zero() {
            return Self::zero();
        }

        let self_items = self.items();
        let other_items = other.items();
        let lhs_max = self_items.len() - 1;
        let rhs_max = other_items.len() - 1;
        let total_max = self_items.len() + other_items.len() - 1;
        let mut result = Self::new_sized(Sign::default(), total_max + 1);
        let mut i: usize = 0;
        while i < total_max {
            let mut j = i.saturating_sub(rhs_max);
            let max = if i < lhs_max { i } else { lhs_max };
            while j <= max {
                result.add_to_item(i, self_items[j] as u128 * other_items[i - j] as u128);
                j += 1;
            }
            i += 1;
        }

        result.normalize();
        result
    }
}
