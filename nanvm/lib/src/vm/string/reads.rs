use super::String;
use crate::{
    common::sized_index::SizedIndex,
    vm::{Any, IVm, Number, ToAny, ToString, position::relative},
};

impl<A: IVm> String<A> {
    /// `String.prototype.at(index)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.at>): the code unit at
    /// a [`relative`] position, counted from the end when negative, as a
    /// one-unit string, or `undefined` out of range.
    pub(crate) fn at(&self, index: Any<A>) -> Result<Any<A>, Any<A>> {
        let k = relative(index, self.length())?;
        Ok(self
            .unit_at(k)
            .map_or_else(|| Any::undefined(), |u| String::of_unit(u).to_any()))
    }

    /// `String.prototype.charAt(pos)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.charat>): the code unit
    /// at a position never counted from the end, as a string, or `""`.
    pub(crate) fn char_at(&self, pos: Any<A>) -> Result<String<A>, Any<A>> {
        Ok(self
            .unit_at(pos.to_integer_or_infinity()?)
            .map_or_else(|| "".into(), String::of_unit))
    }

    /// `String.prototype.charCodeAt(pos)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.charcodeat>): the code
    /// unit at that position as a number, or `NaN`.
    pub(crate) fn char_code_at(&self, pos: Any<A>) -> Result<Number, Any<A>> {
        let unit = self.unit_at(pos.to_integer_or_infinity()?);
        Ok(Number::from(unit.map_or(f64::NAN, f64::from)))
    }

    /// `String.prototype.isWellFormed()`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.iswellformed>): no
    /// surrogate is unpaired.
    pub(crate) fn is_well_formed(&self) -> bool {
        char::decode_utf16(self.clone()).all(|c| c.is_ok())
    }

    /// `String.prototype.toWellFormed()`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.towellformed>): each
    /// unpaired surrogate replaced by U+FFFD, every other unit kept. The
    /// result has the receiver's length, so it cannot pass the limit.
    pub(crate) fn to_well_formed(&self) -> String<A> {
        char::decode_utf16(self.clone())
            .flat_map(|c| {
                let mut buffer = [0u16; 2];
                let units: &[u16] = match c {
                    Ok(c) => c.encode_utf16(&mut buffer),
                    Err(_) => char::REPLACEMENT_CHARACTER.encode_utf16(&mut buffer),
                };
                units.to_vec()
            })
            .to_string()
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, String, ToAny, ToString},
    };

    type A = Naive;

    fn s(units: &[u16]) -> String<A> {
        units.iter().copied().to_string()
    }
    fn n(v: f64) -> Any<A> {
        v.to_any()
    }

    #[test]
    fn at_and_char_at() {
        let abc: String<A> = "abc".into();
        assert_eq!(abc.at(n(-1.0)), Ok("c".into()));
        assert_eq!(abc.at(n(3.0)), Ok(Any::undefined()));
        assert_eq!(abc.char_at(n(1.0)), Ok("b".into()));
        assert_eq!(abc.char_at(n(-1.0)), Ok("".into()));
        assert_eq!(abc.char_at(Any::undefined()), Ok("a".into()));
    }

    #[test]
    fn char_code_at() {
        let abc: String<A> = "abc".into();
        assert_eq!(f64::from(abc.char_code_at(n(0.0)).unwrap()), 97.0);
        assert!(f64::from(abc.char_code_at(n(3.0)).unwrap()).is_nan());
    }

    #[test]
    fn well_formed() {
        assert!(s(&[0xD83D, 0xDE00]).is_well_formed());
        assert!(!s(&[0x61, 0xD800]).is_well_formed());
        assert!(!s(&[0xDC00, 0xD800]).is_well_formed());
        assert_eq!(
            s(&[0x61, 0xD800, 0x62, 0xDC00]).to_well_formed(),
            s(&[0x61, 0xFFFD, 0x62, 0xFFFD])
        );
        assert_eq!(s(&[0xD83D, 0xDE00]).to_well_formed(), s(&[0xD83D, 0xDE00]));
    }
}
