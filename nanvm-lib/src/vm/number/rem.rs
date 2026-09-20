use core::ops::Rem;

use crate::vm::Number;

impl Rem for Number {
    type Output = Self;
    fn rem(self, rhs: Self) -> Self {
        (self.0 % rhs.0).into()
    }
}

#[cfg(test)]
mod tests {
    use crate::vm::{Number, number::tests::bits};

    /// `1 % 0` is `NaN` in JavaScript, and the canonical one here.
    #[test]
    fn nan_is_canonical() {
        let r = Number::from(1.0) % Number::from(0.0);
        assert_eq!(bits(r), bits(Number::NAN));
    }
}
