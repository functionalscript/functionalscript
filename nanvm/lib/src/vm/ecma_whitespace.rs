/// Whether `c` is ECMA-262 `WhiteSpace` or `LineTerminator` — the set
/// `StringToNumber`/`StringToBigInt` trim before parsing.
/// <https://tc39.es/ecma262/#sec-white-space>
/// <https://tc39.es/ecma262/#sec-line-terminators>
///
/// Deliberately not `char::is_whitespace()`: that's Unicode's `White_Space`
/// property, which disagrees with this set in both directions — it trims
/// U+0085 (NEL), which ECMA-262 does not list, and misses U+FEFF (the BOM),
/// which ECMA-262 explicitly includes in `WhiteSpace` (`<ZWNBSP>`) even
/// though Unicode dropped `White_Space` from that code point long ago.
pub(crate) fn is_ecma_whitespace(c: char) -> bool {
    matches!(
        c,
        '\u{0009}'
            | '\u{000A}'
            | '\u{000B}'
            | '\u{000C}'
            | '\u{000D}'
            | '\u{0020}'
            | '\u{00A0}'
            | '\u{1680}'
            | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

#[cfg(test)]
mod tests {
    use super::is_ecma_whitespace;

    #[test]
    fn accepts_ecma_set() {
        for c in [
            '\u{0009}', '\u{000A}', '\u{000B}', '\u{000C}', '\u{000D}', '\u{0020}', '\u{00A0}',
            '\u{FEFF}', '\u{2028}', '\u{2029}', '\u{3000}',
        ] {
            assert!(is_ecma_whitespace(c), "{:?}", c);
        }
    }

    #[test]
    fn rejects_nel_and_ordinary_chars() {
        // U+0085 (NEL) is `char::is_whitespace()` in Rust/Unicode but not
        // ECMA-262 `WhiteSpace`/`LineTerminator`.
        assert!(!is_ecma_whitespace('\u{0085}'));
        assert!(!is_ecma_whitespace('a'));
        assert!(!is_ecma_whitespace('0'));
    }
}
