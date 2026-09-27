#![doc = include_str!("README.md")]

use crate::vm::{Any, BigInt, IVm, Number, String, ToAny, ToString};

/// An `Any` holding the string `v`.
pub fn string_any<A: IVm>(v: &str) -> Any<A> {
    v.into()
}

/// An object property key.
pub fn string_key<A: IVm>(v: &str) -> String<A> {
    v.into()
}

/// An `Any` holding the string of UTF-16 code units `v`: the spelling of a
/// string no `&str` can hold, one with a lone surrogate.
pub fn string_any_utf16<A: IVm>(v: &[u16]) -> Any<A> {
    string_key_utf16::<A>(v).to_any()
}

/// An object property key of UTF-16 code units, for the same reason.
pub fn string_key_utf16<A: IVm>(v: &[u16]) -> String<A> {
    v.iter().copied().to_string()
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

/// `===` as an operator result. `==` on `Any` is exactly JavaScript's `===`,
/// but it yields a `bool` and so pins neither operand's `A`; this gives both
/// the same one and lifts the answer into the `Result` every other operator
/// returns, so a printed `===` is a statement like any other operator's.
pub fn strict_eq<A: IVm>(a: Any<A>, b: Any<A>) -> Result<Any<A>, Any<A>> {
    Ok((a == b).to_any())
}

/// `!==`, the negation of [`strict_eq`], for the same reason.
pub fn strict_ne<A: IVm>(a: Any<A>, b: Any<A>) -> Result<Any<A>, Any<A>> {
    Ok((a != b).to_any())
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::{common::sized_index::SizedIndex, naive::Naive, vm::Unpacked};

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

    /// The two answer each other's negation, `NaN` against itself included:
    /// `NaN === NaN` is `false` and `NaN !== NaN` is `true`, as in JavaScript.
    #[test]
    fn strict_equality() {
        let one = || f64_any::<Naive>(0x3ff0000000000000);
        let nan = || f64_any::<Naive>(0x7ff8000000000000);
        assert_eq!(strict_eq(one(), one()), Ok(true.to_any()));
        assert_eq!(strict_ne(one(), one()), Ok(false.to_any()));
        assert_eq!(strict_eq(nan(), nan()), Ok(false.to_any()));
        assert_eq!(strict_ne(nan(), nan()), Ok(true.to_any()));
        assert_eq!(strict_eq(one(), string_any("1")), Ok(false.to_any()));
    }

    /// A string of code units holds what no `&str` can, a lone surrogate,
    /// and agrees with the `&str` spelling where both exist.
    #[test]
    fn strings_of_code_units() {
        let lone = string_key_utf16::<Naive>(&[0x61, 0xd800]);
        assert_eq!(lone.length(), 2);
        assert_eq!(lone[1], 0xd800);
        assert_eq!(string_any_utf16::<Naive>(&[0x61, 0x62]), string_any("ab"));
        assert_eq!(string_key_utf16::<Naive>(&[]), string_key(""));
    }
}
