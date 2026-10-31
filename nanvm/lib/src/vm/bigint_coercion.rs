use crate::vm::{
    Any, BigInt, Function, IVm, Number, String, error, nullish::Nullish,
    primitive_coercion::ToPrimitivePreferredType, primitive_dispatch::PrimitiveDispatch,
    string_numeric_literal::string_to_bigint,
};

/// The explicit BigInt operator accepts integral numbers as well as the
/// primitives accepted by abstract ToBigInt. Containers use the number hint.
pub(crate) struct BigIntCoercion;

impl<A: IVm> PrimitiveDispatch<A> for BigIntCoercion {
    type Ok = BigInt<A>;
    const PREFERRED: ToPrimitivePreferredType = ToPrimitivePreferredType::Number;

    fn nullish(self, _: Nullish) -> Result<BigInt<A>, Any<A>> {
        Err(error::unexpected_type())
    }

    fn bool(self, v: bool) -> Result<BigInt<A>, Any<A>> {
        Ok(u64::from(v).into())
    }

    fn number(self, v: Number) -> Result<BigInt<A>, Any<A>> {
        BigInt::from_integral(v).ok_or_else(error::number_to_bigint)
    }

    fn string(self, v: String<A>) -> Result<BigInt<A>, Any<A>> {
        let text: std::string::String = v.into();
        string_to_bigint(&text)?.ok_or_else(error::string_to_bigint)
    }

    fn bigint(self, v: BigInt<A>) -> Result<BigInt<A>, Any<A>> {
        Ok(v)
    }

    fn function(self, _: Function<A>) -> Result<BigInt<A>, Any<A>> {
        // Function source cannot be a StringIntegerLiteral.
        Err(error::string_to_bigint())
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, BigInt, Nullish, ToAny, ToArray, ToObject},
    };

    fn converted(value: Any<Naive>, expected: i64) {
        assert_eq!(value.bigint().unwrap(), BigInt::from(expected).to_any());
    }

    #[test]
    fn primitives() {
        converted(true.to_any(), 1);
        converted(false.to_any(), 0);
        converted(42.0.to_any(), 42);
        converted((-0.0).to_any(), 0);
        converted(BigInt::from(-7i64).to_any(), -7);
        for (text, expected) in [
            ("", 0),
            (" ", 0),
            (" +0012 ", 12),
            ("-7", -7),
            ("0xFF", 255),
            ("0O17", 15),
            ("0b101", 5),
        ] {
            converted(text.into(), expected);
        }
        let n = 2f64.powi(100);
        assert_eq!(
            n.to_any().bigint().unwrap(),
            BigInt::<Naive>::from_integral(n.into()).unwrap().to_any()
        );
    }

    #[test]
    fn invalid_primitives() {
        for value in [
            Nullish::Null.to_any(),
            Nullish::Undefined.to_any(),
            1.5.to_any(),
            f64::NAN.to_any(),
            f64::INFINITY.to_any(),
            f64::NEG_INFINITY.to_any(),
        ] {
            assert!(Any::<Naive>::bigint(value).is_err());
        }
        for text in ["1.0", "1e3", "1n", "0x", "-0x1", "1_000", "+", "x"] {
            assert!(Any::<Naive>::from(text).bigint().is_err());
        }
    }

    #[test]
    fn containers() {
        converted([].to_array().to_any(), 0);
        converted([7.0.to_any()].to_array().to_any(), 7);
        assert!(
            [1.0.to_any::<Naive>(), 2.0.to_any()]
                .to_array()
                .to_any()
                .bigint()
                .is_err()
        );
        assert!(Any::<Naive>::bigint([].to_object().to_any()).is_err());
    }
}
