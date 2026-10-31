use super::String;
use crate::vm::{Any, Array, IVm, ToString};

impl<A: IVm> String<A> {
    /// `String.fromCharCode(...args)`: ToUint16 of each argument, in order.
    /// Code units are preserved, including unpaired surrogates.
    pub fn from_char_code(args: Array<A>) -> Result<Self, Any<A>> {
        let units = args
            .into_iter()
            .map(|value| value.to_number().map(|number| number.to_uint32() as u16))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(units.into_iter().to_string())
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, String, ToAny, ToArray},
    };

    #[test]
    fn code_units_and_coercion() {
        let args: [Any<Naive>; 8] = [
            5.0.to_any(),
            6.0.to_any(),
            (-1.5).to_any(),
            (0x1_0041 as f64).to_any(),
            (0xd800 as f64).to_any(),
            f64::NAN.to_any(),
            f64::INFINITY.to_any(),
            "66".into(),
        ];
        let actual = String::from_char_code(args.to_array()).unwrap();
        assert_eq!(
            actual.into_iter().collect::<Vec<_>>(),
            [5, 6, 0xffff, 0x41, 0xd800, 0, 0, 0x42]
        );
        assert_eq!(
            String::<Naive>::from_char_code([].to_array())
                .unwrap()
                .into_iter()
                .count(),
            0
        );
    }

    #[test]
    fn conversion_failure() {
        let args: [Any<Naive>; 2] = [65.0.to_any(), crate::vm::BigInt::from(1u64).to_any()];
        assert!(String::from_char_code(args.to_array()).is_err());
    }
}
