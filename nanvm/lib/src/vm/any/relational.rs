use core::cmp::Ordering;

use crate::vm::{
    Any, IVm, ToAny, Unpacked, error, numeric::Numeric, primitive::Primitive,
    primitive_coercion::ToPrimitivePreferredType, string_numeric_literal::string_to_bigint,
};

impl<A: IVm> Any<A> {
    /// `<`. Throws where `ToPrimitive` does, and where the text of a function
    /// without text would be compared (`error::function_text`).
    pub fn lt(self, rhs: Self) -> Result<Self, Self> {
        Ok(matches!(compare(self, rhs)?, Some(Ordering::Less)).to_any())
    }

    /// `>`.
    pub fn gt(self, rhs: Self) -> Result<Self, Self> {
        Ok(matches!(compare(self, rhs)?, Some(Ordering::Greater)).to_any())
    }

    /// `<=`. Not `!(x > y)`: a `NaN` anywhere gives `false`.
    pub fn le(self, rhs: Self) -> Result<Self, Self> {
        Ok(matches!(compare(self, rhs)?, Some(Ordering::Less | Ordering::Equal)).to_any())
    }

    /// `>=`. Not `!(x < y)`: a `NaN` anywhere gives `false`.
    pub fn ge(self, rhs: Self) -> Result<Self, Self> {
        Ok(matches!(
            compare(self, rhs)?,
            Some(Ordering::Greater | Ordering::Equal)
        )
        .to_any())
    }
}

/// <https://tc39.es/ecma262/#sec-islessthan>, answered as the order of `x`
/// relative to `y`, so `>` and `<=` read it rather than ask `<` of swapped
/// operands. `None` is the spec's `undefined` — comparisons that involve
/// `NaN`, directly or via a string that fails `StringToBigInt` against a
/// `BigInt` — which every operator answers `false`.
///
/// Both operands' `ToPrimitive` run left first, the spec's `LeftFirst` flag.
/// The order is observable, since an object's own `valueOf` or `toString` may
/// throw: `a > b` with both throwing throws `a`'s.
fn compare<A: IVm>(x: Any<A>, y: Any<A>) -> Result<Option<Ordering>, Any<A>> {
    let px = to_primitive_or_text(x)?;
    match (px, to_primitive_or_text(y)?) {
        // A function's text against a string compares the texts.
        (None, None) | (None, Some(Primitive::String(_))) | (Some(Primitive::String(_)), None) => {
            Err(error::function_text())
        }
        // Against anything else, the text is numeric: `NaN` for a number
        // and no `StringToBigInt` for a bigint, so `undefined` either way.
        (None, Some(_)) | (Some(_), None) => Ok(None),
        (Some(px), Some(py)) => compare_primitives(px, py),
    }
}

/// `ToPrimitive(v, number)`, where `None` is the text of a function that has
/// none (`error::function_text`). A function's text is a string that neither
/// `StringToNumber` nor `StringToBigInt` accepts, so `compare` answers a
/// function without text against a number or a bigint, and refuses it only
/// against a string.
fn to_primitive_or_text<A: IVm>(v: Any<A>) -> Result<Option<Primitive<A>>, Any<A>> {
    match v.clone().into() {
        Unpacked::Function(f) => Ok(f.text().map(|t| Primitive::String(t.into()))),
        _ => v
            .to_primitive(Some(ToPrimitivePreferredType::Number))
            .map(Some),
    }
}

fn compare_primitives<A: IVm>(
    px: Primitive<A>,
    py: Primitive<A>,
) -> Result<Option<Ordering>, Any<A>> {
    match (px, py) {
        (Primitive::String(sx), Primitive::String(sy)) => Ok(Some(sx.cmp(&sy))),
        (Primitive::BigInt(bx), Primitive::String(sy)) => {
            let s: std::string::String = sy.into();
            Ok(string_to_bigint(&s)?.map(|by| bx.cmp(&by)))
        }
        (Primitive::String(sx), Primitive::BigInt(by)) => {
            let s: std::string::String = sx.into();
            Ok(string_to_bigint(&s)?.map(|bx| bx.cmp(&by)))
        }
        (px, py) => Ok(primitive_to_numeric(px)?.compare(&primitive_to_numeric(py)?)),
    }
}

/// The non-`BigInt` half of `Any::to_numeric` — `px`/`py` are already
/// primitives here, so this skips the `ToPrimitive` call `to_numeric` would
/// otherwise repeat.
fn primitive_to_numeric<A: IVm>(p: Primitive<A>) -> Result<Numeric<A>, Any<A>> {
    match p {
        Primitive::BigInt(bi) => Ok(Numeric::BigInt(bi)),
        other => Ok(Numeric::Number(Any::from(other).to_number()?)),
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, ToAny},
    };

    type A = Naive;

    fn n(v: f64) -> Any<A> {
        v.to_any()
    }

    fn big(v: i64) -> Any<A> {
        Into::<BigInt<A>>::into(v).to_any()
    }

    fn bool_of(r: Result<Any<A>, Any<A>>) -> bool {
        bool::try_from(r.unwrap()).unwrap()
    }

    #[test]
    fn number_lt_number() {
        assert!(bool_of(n(1.0).lt(n(2.0))));
        assert!(!bool_of(n(2.0).lt(n(1.0))));
    }

    #[test]
    fn nan_is_never_less() {
        assert!(!bool_of(n(f64::NAN).lt(n(1.0))));
        assert!(!bool_of(n(1.0).lt(n(f64::NAN))));
        assert!(!bool_of(n(f64::NAN).le(n(1.0))));
        assert!(!bool_of(n(1.0).le(n(f64::NAN))));
    }

    #[test]
    fn nan_is_never_greater() {
        assert!(!bool_of(n(f64::NAN).gt(n(1.0))));
        assert!(!bool_of(n(1.0).gt(n(f64::NAN))));
        assert!(!bool_of(n(f64::NAN).ge(n(1.0))));
        assert!(!bool_of(big(1).ge(n(f64::NAN))));
    }

    #[test]
    fn number_vs_bigint_each_operator() {
        assert!(bool_of(n(5.5).gt(big(5))));
        assert!(!bool_of(n(5.0).gt(big(5))));
        assert!(bool_of(n(5.0).ge(big(5))));
        assert!(!bool_of(n(4.5).ge(big(5))));
        assert!(bool_of(n(4.5).lt(big(5))));
        assert!(bool_of(n(5.0).le(big(5))));
        assert!(bool_of(n(f64::INFINITY).gt(big(5))));
        assert!(bool_of(n(f64::NEG_INFINITY).lt(big(5))));
    }

    #[test]
    fn string_lexicographic() {
        let s = |v: &str| -> Any<A> { v.into() };
        assert!(bool_of(s("10").lt(s("9"))));
        assert!(!bool_of(s("9").lt(s("10"))));
    }

    #[test]
    fn bigint_vs_number_exact() {
        assert!(bool_of(big(5).lt(n(5.5))));
        assert!(!bool_of(big(5).lt(n(5.0))));
        assert!(bool_of(big(5).le(n(5.0))));
        assert!(bool_of(big(5).lt(n(f64::INFINITY))));
        assert!(!bool_of(big(5).lt(n(f64::NEG_INFINITY))));
    }

    #[test]
    fn large_bigint_vs_large_number_exact() {
        // 2^60 vs 2^60 + 2048 as a whole f64 (both exactly representable):
        // rounding the `BigInt` down to `f64` first would be wrong here,
        // since a naive `bi.to_f64() < f` could compare equal instead.
        assert!(bool_of(
            big(1i64 << 60).lt(n((1u64 << 60) as f64 + 2_048.0))
        ));
    }

    #[test]
    fn string_to_bigint_comparison() {
        let s = |v: &str| -> Any<A> { v.into() };
        assert!(bool_of(s("10").lt(big(20))));
        assert!(bool_of(big(20).lt(s("30"))));
        assert!(!bool_of(s("abc").lt(big(20))));
        assert!(!bool_of(big(20).lt(s("abc"))));
    }
}
