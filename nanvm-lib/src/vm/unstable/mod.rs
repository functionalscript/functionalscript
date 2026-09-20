#![doc = include_str!("README.md")]

use crate::vm::{Any, BigInt, IVm, Number, String, ToAny};

/// An `Any` holding the string `v`.
pub fn string_any<A: IVm>(v: &str) -> Any<A> {
    v.into()
}

/// An object property key.
pub fn string_key<A: IVm>(v: &str) -> String<A> {
    v.into()
}

/// An `Any` holding the bigint `v`.
pub fn bigint_any<A: IVm>(v: i64) -> Any<A> {
    Into::<BigInt<A>>::into(v).to_any()
}

/// An `Any` holding the number whose IEEE 754 bits are `v` — the one
/// spelling `fjs/media/rust` gives every number, so a generated module holds
/// the double a JavaScript engine held, bit for bit, `-0` included, except a
/// `NaN`: the language has one, so every `NaN` arrives as the quiet,
/// empty-payload one, whatever sign or payload the engine held it with.
pub fn f64_any<A: IVm>(v: u64) -> Any<A> {
    Number::from(f64::from_bits(v)).to_any()
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{naive::Naive, vm::Unpacked};

    #[test]
    fn strings() {
        let direct: Any<Naive> = "a".into();
        assert_eq!(string_any::<Naive>("a"), direct);
        let key: String<Naive> = "a".into();
        assert_eq!(string_key::<Naive>("a"), key);
    }

    #[test]
    fn bigints() {
        assert_eq!(
            bigint_any::<Naive>(-1),
            Into::<BigInt<Naive>>::into(-1i64).to_any()
        );
    }

    #[test]
    fn numbers_by_their_bits() {
        let bits = |v: Any<Naive>| match v.into() {
            Unpacked::Number(x) => f64::from(x).to_bits(),
            _ => panic!("a number"),
        };
        assert_eq!(bits(f64_any(0x4002666666666666)), 2.3f64.to_bits());
        assert_eq!(bits(f64_any(0x8000000000000000)), (-0f64).to_bits());
        assert_eq!(bits(f64_any(0x7ff8000000000000)), 0x7ff8000000000000);
    }
}
