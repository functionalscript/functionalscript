pub trait DivMod: Sized {
    fn div_mod(self, divisor: Self) -> (Self, Self);
}

impl DivMod for u64 {
    fn div_mod(self, divisor: Self) -> (Self, Self) {
        (self / divisor, self % divisor)
    }
}
