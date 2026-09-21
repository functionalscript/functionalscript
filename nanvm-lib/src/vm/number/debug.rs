use core::fmt::{Debug, Formatter, Result};

use crate::vm::Number;

/// The bare `f64`, as every other `Unpacked` payload prints bare: a numeric
/// `Any` reads `1.0`, not `Number(1.0)`, in a test's failure message.
impl Debug for Number {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        self.0.fmt(f)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Number, ToAny},
    };

    #[test]
    fn bare_through_any() {
        let one: Any<Naive> = Number::from(1.0).to_any();
        assert_eq!(format!("{one:?}"), "1.0");
        assert_eq!(format!("{:?}", Number::NAN), "NaN");
    }
}
