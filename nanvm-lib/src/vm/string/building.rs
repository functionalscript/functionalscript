use super::{String, code_unit::position, create::create};
use crate::{
    common::sized_index::SizedIndex,
    vm::{
        Any, Array, IVm, Nullish, ToString, Unpacked,
        array::relative::{clamped, relative},
        ecma_whitespace::is_ecma_whitespace,
    },
};

/// Whether `v` is `undefined`, the absent value several arguments default on.
fn is_undefined<A: IVm>(v: &Any<A>) -> bool {
    matches!(
        Unpacked::from(v.clone()),
        Unpacked::Nullish(Nullish::Undefined)
    )
}

/// Whether the code unit `u` is ECMAScript `WhiteSpace` or `LineTerminator`.
/// Every such character is one code unit, so a surrogate never is.
fn is_space(u: u16) -> bool {
    char::from_u32(u32::from(u)).is_some_and(is_ecma_whitespace)
}

impl<A: IVm> String<A> {
    /// The code units from `from` up to, not including, `to`.
    fn units(&self, from: u32, to: u32) -> String<A> {
        (from..to.max(from)).map(|i| self[i]).to_string()
    }

    /// `String.prototype.slice(start, end)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.slice>): the code units
    /// between two [`relative`] positions clamped into the string, the end
    /// the length when `undefined`.
    pub(crate) fn slice(&self, start: Any<A>, end: Any<A>) -> Result<String<A>, Any<A>> {
        let len = self.length();
        let from = clamped(relative(start, len)?, len);
        let to = if is_undefined(&end) {
            len
        } else {
            clamped(relative(end, len)?, len)
        };
        Ok(self.units(from, to))
    }

    /// `String.prototype.substring(start, end)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.substring>): the code
    /// units between two positions never counted from the end, each clamped
    /// into the string and swapped if `start` is past `end`; the end is the
    /// length when `undefined`.
    pub(crate) fn substring(&self, start: Any<A>, end: Any<A>) -> Result<String<A>, Any<A>> {
        let len = self.length();
        let start = clamped(position(start)?, len);
        let end = if is_undefined(&end) {
            len
        } else {
            clamped(position(end)?, len)
        };
        Ok(self.units(start.min(end), start.max(end)))
    }

    /// `String.prototype.concat(...args)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.concat>): the receiver,
    /// then each argument's `ToString`, in order.
    pub(crate) fn concat(&self, args: Array<A>) -> Result<String<A>, Any<A>> {
        let parts: Vec<String<A>> = [Ok(self.clone())]
            .into_iter()
            .chain(args.into_iter().map(|v| v.to_string()))
            .collect::<Result<_, _>>()?;
        let len = parts.iter().map(|p| u64::from(p.length())).sum();
        create(len, parts.into_iter().flatten())
    }

    /// `String.prototype.repeat(count)`
    /// (<https://tc39.es/ecma262/#sec-string.prototype.repeat>): the receiver
    /// `count` times. A negative or infinite count is a `RangeError`, even on
    /// `""`, as it is in JavaScript.
    pub(crate) fn repeat(&self, count: Any<A>) -> Result<String<A>, Any<A>> {
        let n = position(count)?;
        if n < 0.0 || n.is_infinite() {
            return Err("RangeError: Invalid count value".into());
        }
        if n == 0.0 || self.length() == 0 {
            return Ok("".into());
        }
        let len = u64::from(self.length()).saturating_mul(n as u64);
        create(len, (0..n as u64).flat_map(|_| self.clone()))
    }

    /// `String.prototype.padStart(len, fill)` and `padEnd`
    /// (<https://tc39.es/ecma262/#sec-stringpaddingbuiltinsimpl>): the
    /// receiver padded to `ToLength(len)` code units with `fill` repeated and
    /// cut to fit, at the start or the end. No padding when the target is
    /// not above the length, and then `fill` is not even converted. `fill` is
    /// `" "` when `undefined`, else its `ToString` — `null` pads with
    /// `"null"` — and an empty `fill` pads nothing.
    pub(crate) fn pad(
        &self,
        target: Any<A>,
        fill: Any<A>,
        at_start: bool,
    ) -> Result<String<A>, Any<A>> {
        let len = self.length();
        let target = position(target)?.clamp(0.0, 9_007_199_254_740_991.0);
        if target <= f64::from(len) {
            return Ok(self.clone());
        }
        let fill: String<A> = if is_undefined(&fill) {
            " ".into()
        } else {
            fill.to_string()?
        };
        if fill.length() == 0 {
            return Ok(self.clone());
        }
        let target = target as u64;
        let padding =
            (0..target - u64::from(len)).map(|i| fill[(i % u64::from(fill.length())) as u32]);
        if at_start {
            create(target, padding.chain(self.clone()))
        } else {
            create(target, self.clone().into_iter().chain(padding))
        }
    }

    /// `String.prototype.trim()`, `trimStart()` and `trimEnd()`
    /// (<https://tc39.es/ecma262/#sec-trimstring>): the receiver without the
    /// ECMAScript `WhiteSpace` and `LineTerminator` at the chosen ends — the
    /// set `Number("…")` trims, `is_ecma_whitespace`.
    pub(crate) fn trim(&self, start: bool, end: bool) -> String<A> {
        let len = self.length();
        let from = if start {
            (0..len).find(|&i| !is_space(self[i])).unwrap_or(len)
        } else {
            0
        };
        let to = if end {
            (from..len)
                .rev()
                .find(|&i| !is_space(self[i]))
                .map_or(from, |i| i + 1)
        } else {
            len
        };
        self.units(from, to)
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        naive::Naive,
        vm::{Any, Nullish, String, ToAny, ToArray},
    };

    type A = Naive;

    fn n(v: f64) -> Any<A> {
        v.to_any()
    }
    fn undefined() -> Any<A> {
        Nullish::Undefined.to_any()
    }
    fn s(v: &str) -> String<A> {
        v.into()
    }

    #[test]
    fn slice_and_substring() {
        assert_eq!(s("abcdef").slice(n(-3.0), n(-1.0)), Ok(s("de")));
        assert_eq!(s("abc").slice(n(1.0), undefined()), Ok(s("bc")));
        assert_eq!(s("abc").slice(n(2.0), n(1.0)), Ok(s("")));
        assert_eq!(s("abcdef").substring(n(4.0), n(1.0)), Ok(s("bcd")));
        assert_eq!(s("abc").substring(n(-1.0), undefined()), Ok(s("abc")));
        assert_eq!(s("abc").substring(n(f64::NAN), n(2.0)), Ok(s("ab")));
    }

    #[test]
    fn concat() {
        let args = [1.0.to_any(), Nullish::Null.to_any()].to_array();
        assert_eq!(s("a").concat(args), Ok(s("a1null")));
    }

    #[test]
    fn repeat() {
        assert_eq!(s("ab").repeat(n(2.9)), Ok(s("abab")));
        assert_eq!(s("ab").repeat(n(0.0)), Ok(s("")));
        let invalid = Err("RangeError: Invalid count value".into());
        assert_eq!(s("a").repeat(n(-1.0)), invalid);
        assert_eq!(s("").repeat(n(f64::INFINITY)), invalid);
        assert_eq!(s("").repeat(n(1e300)), Ok(s("")));
        assert_eq!(
            s("ab").repeat(n(4_294_967_295.0)),
            Err("RangeError: Invalid string length".into())
        );
    }

    #[test]
    fn pad() {
        assert_eq!(s("5").pad(n(3.0), "0".into(), true), Ok(s("005")));
        assert_eq!(s("abc").pad(n(8.0), "xy".into(), true), Ok(s("xyxyxabc")));
        assert_eq!(s("a").pad(n(3.0), undefined(), false), Ok(s("a  ")));
        assert_eq!(s("a").pad(n(5.0), "".into(), false), Ok(s("a")));
        assert_eq!(s("abc").pad(n(-1.0), "x".into(), true), Ok(s("abc")));
        assert_eq!(
            s("a").pad(n(3.0), Nullish::Null.to_any(), true),
            Ok(s("nua"))
        );
    }

    #[test]
    fn trim() {
        let padded = s(" \t\u{FEFF}a b\u{3000}\n");
        assert_eq!(padded.trim(true, true), s("a b"));
        assert_eq!(padded.trim(true, false), s("a b\u{3000}\n"));
        assert_eq!(padded.trim(false, true), s(" \t\u{FEFF}a b"));
        assert_eq!(s("  ").trim(true, true), s(""));
    }
}
