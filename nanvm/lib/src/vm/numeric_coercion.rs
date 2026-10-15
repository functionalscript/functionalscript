use crate::vm::{
    Any, IVm, number_coercion::NumberCoercion, numeric::Numeric, primitive::Primitive,
    primitive_dispatch::PrimitiveDispatch,
};

/// `ToNumeric` of a value already known to be primitive: a `BigInt` stays one,
/// and everything else is its `ToNumber`.
/// <https://tc39.es/ecma262/#sec-tonumeric>
pub fn to_numeric<A: IVm>(p: Primitive<A>) -> Result<Numeric<A>, Any<A>> {
    // 2. If primValue is a BigInt, return primValue.
    // 3. Return ? ToNumber(primValue).
    Ok(match p {
        Primitive::BigInt(bi) => Numeric::BigInt(bi),
        Primitive::Nullish(n) => Numeric::Number(NumberCoercion.nullish(n)?),
        Primitive::Boolean(b) => Numeric::Number(NumberCoercion.bool(b)?),
        Primitive::Number(n) => Numeric::Number(NumberCoercion.number(n)?),
        Primitive::String(s) => Numeric::Number(NumberCoercion.string(s)?),
    })
}

#[cfg(test)]
mod test {
    use crate::{
        naive::Naive,
        vm::{
            BigInt, Number, nullish::Nullish, numeric::Numeric, numeric_coercion::to_numeric,
            primitive::Primitive,
        },
    };

    type A = Naive;

    fn number(p: Primitive<A>) -> Number {
        let Ok(Numeric::Number(n)) = to_numeric(p) else {
            panic!("not a number");
        };
        n
    }

    #[test]
    fn nullish() {
        assert_eq!(number(Primitive::Nullish(Nullish::Null)), 0.into());
        assert!(number(Primitive::Nullish(Nullish::Undefined)).is_nan());
    }

    #[test]
    fn boolean() {
        assert_eq!(number(Primitive::Boolean(true)), 1.into());
        assert_eq!(number(Primitive::Boolean(false)), 0.into());
    }

    #[test]
    fn number_is_itself() {
        assert_eq!(number(Primitive::Number(Number::from(-2.5))), (-2.5).into());
    }

    #[test]
    fn string() {
        assert_eq!(number(Primitive::String(" 0x10 ".into())), 16.into());
        assert!(number(Primitive::String("1n".into())).is_nan());
    }

    /// A `BigInt` is not converted, so it never throws the `TypeError`
    /// `ToNumber` of a `BigInt` would.
    #[test]
    fn bigint_stays_bigint() {
        let bi: BigInt<A> = 7i64.into();
        assert!(matches!(
            to_numeric(Primitive::BigInt(bi.clone())),
            Ok(Numeric::BigInt(r)) if r == bi
        ));
    }
}
