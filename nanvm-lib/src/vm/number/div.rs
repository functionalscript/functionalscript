use core::ops::Div;

use crate::vm::Number;

impl Div for Number {
    type Output = Self;
    fn div(self, rhs: Self) -> Self {
        (self.0 / rhs.0).into()
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::{Number, number::tests::bits};

    /// `0 / 0`, which x86 answers with a negative `NaN`, comes out canonical.
    #[test]
    fn nan_is_canonical() {
        let zero = Number::from(0.0);
        assert_eq!(bits(zero / zero), bits(Number::NAN));
    }
}
