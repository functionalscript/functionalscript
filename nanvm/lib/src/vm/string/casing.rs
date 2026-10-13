//! `String.prototype.toLowerCase` and `toUpperCase`: the Unicode Default Case
//! Conversion, through the standard library, at the Unicode version the
//! language pins.

use super::{String, create::create};
use crate::vm::{Any, IVm};

/// The Unicode version the language speaks — the one the pinned Rust
/// standard library carries (`fjs/ci/config`), named in `spec/README.md` and
/// in `fjs/js/prototype/README.md`. A module must mean one thing everywhere,
/// so a build whose standard library carries another version does not build.
pub const UNICODE_VERSION: (u8, u8, u8) = (17, 0, 0);

const _: () = assert!(
    char::UNICODE_VERSION.0 == UNICODE_VERSION.0
        && char::UNICODE_VERSION.1 == UNICODE_VERSION.1
        && char::UNICODE_VERSION.2 == UNICODE_VERSION.2,
    "the standard library's Unicode version is not the one the language pins"
);

impl<A: IVm> String<A> {
    /// Each well-formed run converted, a lone surrogate copied unchanged: it
    /// has no case and no `char`, and the lossy conversion to a Rust string
    /// would make it U+FFFD. A lone surrogate is neither cased nor
    /// case-ignorable, so a run ending at one leaves the final-sigma context
    /// as JavaScript reads it. A full mapping can lengthen the result, so it
    /// is counted and may be refused as too long.
    fn convert_case(&self, convert: fn(&str) -> std::string::String) -> Result<String<A>, Any<A>> {
        let mut units: Vec<u16> = Vec::new();
        let mut run = std::string::String::new();
        for c in char::decode_utf16(self.clone()) {
            match c {
                Ok(c) => run.push(c),
                Err(e) => {
                    units.extend(convert(&run).encode_utf16());
                    run.clear();
                    units.push(e.unpaired_surrogate());
                }
            }
        }
        units.extend(convert(&run).encode_utf16());
        create(units.len() as u64, units)
    }

    /// `String.prototype.toLowerCase()`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.tolowercase>).
    pub(crate) fn to_lower_case(&self) -> Result<String<A>, Any<A>> {
        self.convert_case(str::to_lowercase)
    }

    /// `String.prototype.toUpperCase()`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.touppercase>).
    pub(crate) fn to_upper_case(&self) -> Result<String<A>, Any<A>> {
        self.convert_case(str::to_uppercase)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{String, ToString},
    };

    type A = Naive;

    fn s(units: &[u16]) -> String<A> {
        units.iter().copied().to_string()
    }

    #[test]
    fn ascii() {
        let abc: String<A> = "aBc".into();
        assert_eq!(abc.to_lower_case(), Ok("abc".into()));
        assert_eq!(abc.to_upper_case(), Ok("ABC".into()));
    }

    /// A full mapping lengthens the result; a final sigma reads its context.
    #[test]
    fn full_mappings() {
        let sharp_s: String<A> = "ß".into();
        assert_eq!(sharp_s.to_upper_case(), Ok("SS".into()));
        let odos: String<A> = "ΟΔΟΣ".into();
        assert_eq!(odos.to_lower_case(), Ok("οδος".into()));
        let kelvin: String<A> = "\u{212a}".into();
        assert_eq!(kelvin.to_lower_case(), Ok("k".into()));
    }

    /// A pair is one character; a lone surrogate is kept, and ends a run.
    #[test]
    fn surrogates() {
        assert_eq!(
            s(&[0xD801, 0xDC00]).to_lower_case(),
            Ok(s(&[0xD801, 0xDC28]))
        );
        assert_eq!(
            s(&[0x41, 0xD800, 0x42, 0xDC00]).to_lower_case(),
            Ok(s(&[0x61, 0xD800, 0x62, 0xDC00]))
        );
        assert_eq!(
            s(&[0x61, 0xD800, 0x62]).to_upper_case(),
            Ok(s(&[0x41, 0xD800, 0x42]))
        );
        // `Σ` before a lone surrogate is final, as it is before any character
        // that is neither cased nor case-ignorable
        assert_eq!(
            s(&[0x391, 0x3A3, 0xD800]).to_lower_case(),
            Ok(s(&[0x3B1, 0x3C2, 0xD800]))
        );
    }
}
